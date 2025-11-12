import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-request-id, x-user-agent, x-forwarded-for',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

interface RSSItem {
  '@_rdf:about': string
  title: string
  link: string
  description: string
  'dc:creator'?: string
  'dc:date': string
  'dc:identifier': string
  'dc:publisher'?: string
  'prism:publicationDate'?: string
}

interface ParsedRSS {
  'rdf:RDF': {
    channel: {
      title: string
      link: string
      description: string
    }
    item: RSSItem[]
  }
}

interface PaperData {
  title: string
  authors: string[]
  abstract: string
  published_date: string
  doi: string
  source_url: string
  pdf_url: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { limit = 20, pages = 1, timestamp = Date.now() } = await req.json()
    
    // 获取Supabase配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始获取BioRxiv RSS feed，限制: ${limit}, 页数: ${pages}`)
    
    // 获取RSS feed
    const rssUrl = `https://connect.biorxiv.org/biorxiv_xml.php?subject=all&timestamp=${timestamp}`
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'BioRxiv-Daily-Bot/1.0',
        'Accept': 'application/xml, text/xml, */*'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`)
    }
    
    const xmlText = await response.text()
    
    // 解析XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true
    })
    
    const parsed: ParsedRSS = parser.parse(xmlText)
    const items = Array.isArray(parsed['rdf:RDF']?.item) ? parsed['rdf:RDF'].item : [parsed['rdf:RDF']?.item].filter(Boolean)
    
    console.log(`解析到 ${items.length} 篇论文`)
    
    let totalFetched = 0
    let newPapersCount = 0
    const errors: string[] = []
    
    // 处理每篇论文
    for (let i = 0; i < Math.min(items.length, limit); i++) {
      const item = items[i]
      if (!item) continue
      
      try {
        // 提取DOI
        const doiMatch = item['dc:identifier']?.match(/doi:(10\.\d{4,}\/.+)/)
        const doi = doiMatch ? doiMatch[1] : ''
        
        if (!doi) {
          console.warn(`跳过论文 - 无法提取DOI: ${item['dc:identifier']}`)
          continue
        }
        
        // 构建PDF URL
        const pdfUrl = item.link.replace(/\?rss=1$/, '.full.pdf')
        
        // 解析作者
        let authors: string[] = []
        if (item['dc:creator']) {
          // 解析作者格式: "Author1, F. M., Author2, L. M."
          authors = item['dc:creator']
            .split(/\s*,\s*/)
            .filter(author => author.trim().length > 0)
            .map(author => author.trim())
        }
        
        const paperData: PaperData = {
          title: item.title?.trim() || 'Untitled',
          authors: authors,
          abstract: item.description?.trim() || '',
          published_date: item['dc:date'] || item['prism:publicationDate'] || new Date().toISOString().split('T')[0],
          doi: doi,
          source_url: item.link,
          pdf_url: pdfUrl
        }
        
        // 检查是否已存在
        const { data: existingPaper } = await supabase
          .from('papers')
          .select('id')
          .eq('doi', doi)
          .maybeSingle()
        
        if (existingPaper) {
          console.log(`论文已存在，跳过: ${doi}`)
          continue
        }
        
        // 插入新论文
        const { error: insertError } = await supabase
          .from('papers')
          .insert({
            title: paperData.title,
            authors: paperData.authors,
            abstract: paperData.abstract,
            published_date: paperData.published_date,
            doi: paperData.doi,
            source_url: paperData.source_url,
            pdf_url: paperData.pdf_url
          })
        
        if (insertError) {
          console.error(`插入论文失败: ${doi}`, insertError)
          errors.push(`插入失败 ${doi}: ${insertError.message}`)
          continue
        }
        
        totalFetched++
        newPapersCount++
        console.log(`成功添加论文: ${doi} - ${paperData.title}`)
        
      } catch (error) {
        console.error(`处理论文失败:`, error)
        errors.push(`处理失败: ${error.message}`)
      }
    }
    
    console.log(`获取完成！共处理 ${totalFetched} 篇，新增 ${newPapersCount} 篇`)
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total_fetched: totalFetched,
          new_papers: newPapersCount,
          errors: errors
        },
        message: `成功获取 ${totalFetched} 篇论文，新增 ${newPapersCount} 篇`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error('获取论文失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }