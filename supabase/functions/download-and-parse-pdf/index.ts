import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 引入 pdfjs-dist 用于提取文本
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174'
import { createHash } from 'https://deno.land/std@0.208.0/crypto/mod.ts'

// 设置 Worker 源
// @ts-ignore: Deno type check workaround
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface PDFParseResult {
  full_text: string
  word_count: number
  page_count: number
  sections: Record<string, any>
  figures: Array<Record<string, any>>
  tables: Array<Record<string, any>>
  references: Array<Record<string, any>>
  doi_references: string[]
}

interface Section {
  title: string
  content: string
  level: number
  page: number
}

interface Figure {
  caption: string
  page: number
  description: string
  type: 'figure' | 'table'
}

interface Reference {
  text: string
  doi?: string
  authors?: string[]
  year?: number
  journal?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { paper_id, pdf_url, force_reparse = false } = await req.json()
    
    if (!paper_id || !pdf_url) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: '缺少必需参数: paper_id 和 pdf_url' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 获取Supabase配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始下载和解析PDF: ${pdf_url}`)
    
    // 检查是否已存在解析结果
    if (!force_reparse) {
      const { data: existingFulltext, error: checkError } = await supabase
        .from('paper_fulltext')
        .select('*')
        .eq('paper_id', paper_id)
        .maybeSingle()
      
      if (checkError) {
        console.error('检查现有全文失败:', checkError)
      } else if (existingFulltext) {
        console.log('全文已存在，跳过解析')
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              fulltext_id: existingFulltext.id,
              word_count: existingFulltext.word_count,
              page_count: existingFulltext.page_count,
              cached: true
            },
            message: '全文内容已存在'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // 下载PDF文件
    // 增加反爬虫 Headers
    const pdfResponse = await fetch(pdf_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.biorxiv.org/'
      },
      timeout: 30000 // 30秒超时
    })
    
    if (!pdfResponse.ok) {
      throw new Error(`PDF下载失败: ${pdfResponse.status} ${pdfResponse.statusText}`)
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer()
    console.log(`PDF下载完成，大小: ${pdfBuffer.byteLength} 字节`)
    
    // 解析PDF内容
    console.log('开始解析PDF内容...')
    const parseResult = await parsePDFContent(pdfBuffer)
    console.log(`PDF解析完成: ${parseResult.word_count} 字, ${parseResult.page_count} 页`)
    
    // 生成文本哈希
    const textHash = await generateTextHash(parseResult.full_text)
    
    // 存储解析结果
    console.log('保存全文内容到数据库...')
    const { data: savedData, error: saveError } = await supabase
      .from('paper_fulltext')
      .upsert({
        paper_id,
        full_text: parseResult.full_text,
        text_hash: textHash,
        word_count: parseResult.word_count,
        page_count: parseResult.page_count,
        sections: parseResult.sections,
        figures: parseResult.figures,
        tables: parseResult.tables,
        references: parseResult.references,
        doi_references: parseResult.doi_references
      }, {
        onConflict: 'paper_id'
      })
      .select()
      .single()
    
    if (saveError) {
      throw new Error(`保存全文失败: ${saveError.message}`)
    }
    
    console.log('全文内容保存成功')
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fulltext_id: savedData.id,
          word_count: parseResult.word_count,
          page_count: parseResult.page_count,
          sections_count: Object.keys(parseResult.sections).length,
          figures_count: parseResult.figures.length,
          tables_count: parseResult.tables.length,
          references_count: parseResult.references.length
        },
        message: 'PDF下载和解析成功'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('PDF处理失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'PDF_PROCESSING_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function parsePDFContent(pdfBuffer: ArrayBuffer): Promise<PDFParseResult> {
  try {
    // 1. 加载 PDF 文档
    // @ts-ignore: pdfjsLib type definition issue
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true
    })

    const pdfDoc = await loadingTask.promise
    const pageCount = pdfDoc.numPages
    
    console.log(`PDF文档共${pageCount}页`)
    
    let fullText = ''
    const sections: Record<string, any> = {
      introduction: '',
      methods: '',
      results: '',
      discussion: '',
      conclusion: '',
      acknowledgments: '',
      references: ''
    }
    
    const figures: Figure[] = []
    const tables: Figure[] = []
    const references: Reference[] = []
    const doiReferences: string[] = []
    
    // 2. 提取每页的文本内容
    // PDF.js 的页码从 1 开始
    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdfDoc.getPage(i)
        const textContent = await page.getTextContent()
        
        // 简单的文本拼接策略
        // 进阶策略：可以根据 item.transform[5] (Y坐标) 来判断是否换行
        let lastY = -1
        let pageText = ''
        
        // @ts-ignore: item type
        for (const item of textContent.items) {
            // @ts-ignore: transform property
            const currentY = item.transform[5]
            if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
                pageText += '\n'
            } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                pageText += ' '
            }
            // @ts-ignore: str property
            pageText += item.str
            lastY = currentY
        }

        if (pageText.trim()) {
          fullText += `\n\n--- 第 ${i} 页 ---\n\n`
          fullText += pageText
        }
      } catch (pageError) {
        console.warn(`第 ${i} 页解析失败:`, pageError)
        fullText += `\n\n--- 第 ${i} 页 (解析失败) ---\n\n`
      }
    }
    
    // 释放内存
    if (pdfDoc.destroy) pdfDoc.destroy()
    
    // 3. 后续处理 (章节识别、图表提取等)
    const identifiedSections = identifySections(fullText)
    Object.assign(sections, identifiedSections)
    
    const extractedFigures = extractFiguresAndTables(fullText)
    figures.push(...extractedFigures.filter(f => f.type === 'figure'))
    tables.push(...extractedFigures.filter(f => f.type === 'table'))
    
    const extractedReferences = extractReferences(fullText)
    references.push(...extractedReferences.references)
    doiReferences.push(...extractedReferences.doiReferences)
    
    const wordCount = fullText.split(/\s+/).length
    
    return {
      full_text: fullText.trim(),
      word_count: wordCount,
      page_count: pageCount,
      sections,
      figures,
      tables,
      references,
      doi_references: doiReferences
    }
    
  } catch (error) {
    console.error('PDF解析失败:', error)
    throw new Error(`PDF解析失败: ${error.message}`)
  }
}

function identifySections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = text.split('\n').filter(line => line.trim())
  
  // 定义章节标题的正则表达式模式
  const sectionPatterns = {
    introduction: /^\s*(?:introduction|背景|引言|简介)\s*$/i,
    methods: /^\s*(?:methods?|materials?\s+and\s+methods?|实验方法|方法)\s*$/i,
    results: /^\s*(?:results?|结果|研究发现)\s*$/i,
    discussion: /^\s*(?:discussion|讨论|分析)\s*$/i,
    conclusion: /^\s*(?:conclusion|conclusions|结论|总结)\s*$/i,
    acknowledgments: /^\s*(?:acknowledgments?|致谢|感谢)\s*$/i,
    references: /^\s*(?:references?|bibliography|参考文献|引用)\s*$/i
  }
  
  let currentSection = ''
  let currentContent = ''
  
  for (const line of lines) {
    let matched = false
    
    for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line)) {
        // 保存前一个章节的内容
        if (currentSection && currentContent) {
          sections[currentSection] = currentContent.trim()
        }
        
        currentSection = sectionName
        currentContent = ''
        matched = true
        break
      }
    }
    
    if (!matched && currentSection) {
      currentContent += line + '\n'
    }
  }
  
  // 保存最后一个章节
  if (currentSection && currentContent) {
    sections[currentSection] = currentContent.trim()
  }
  
  return sections
}

function extractFiguresAndTables(text: string): Figure[] {
  const figures: Figure[] = []
  
  // 图表标题的正则表达式
  const figurePattern = /(?:Figure|Fig\.|图)\s+(\d+)[.:]?\s+([^\n]+)/gi
  const tablePattern = /(?:Table|Tab\.|表)\s+(\d+)[.:]?\s+([^\n]+)/gi
  
  let match
  
  // 提取图表
  while ((match = figurePattern.exec(text)) !== null) {
    figures.push({
      caption: match[0],
      page: 1, // 需要更精确的页面定位
      description: '',
      type: 'figure'
    })
  }
  
  // 提取表格
  while ((match = tablePattern.exec(text)) !== null) {
    figures.push({
      caption: match[0],
      page: 1, // 需要更精确的页面定位
      description: '',
      type: 'table'
    })
  }
  
  return figures
}

function extractReferences(text: string): { references: Reference[], doiReferences: string[] } {
  const references: Reference[] = []
  const doiReferences: string[] = []
  
  // DOI提取模式
  const doiPattern = /10\.\d{4,}\/[^\s]+/g
  const doiMatches = text.match(doiPattern) || []
  doiReferences.push(...doiMatches)
  
  // 参考文献条目提取（简化版）
  const refPattern = /^\s*(\d+)\.\s+(.+)$/gm
  let match
  
  while ((match = refPattern.exec(text)) !== null) {
    const refText = match[2]
    
    references.push({
      text: refText,
      doi: doiMatches.find(doi => refText.includes(doi)),
      authors: [], // 需要更复杂的解析
      year: null,  // 需要提取年份
      journal: ''  // 需要提取期刊名
    })
  }
  
  return { references, doiReferences: [...new Set(doiReferences)] }
}

async function generateTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await createHash('sha-256').update(data).digest()
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
