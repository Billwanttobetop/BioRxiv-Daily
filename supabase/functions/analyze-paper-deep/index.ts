import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface DeepAnalysisRequest {
  paper_id: string
  analysis_type?: 'comprehensive' | 'quick' | 'focused'
  focus_areas?: string[] // 可选：指定关注的分析领域
  full_text?: string // 可选：提供全文内容，如果不提供则从数据库获取
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface DeepAnalysisResult {
  motivation: string
  insights: string[]
  methods: {
    overview: string
    key_techniques: string[]
    innovations: string[]
  }
  experiments: {
    design: string
    datasets: string[]
    metrics: string[]
    baselines: string[]
  }
  results: {
    main_findings: string[]
    performance_gains: string[]
    significance: string
    limitations: string[]
  }
  technical_novelty_score: number
  practical_impact_score: number
  theoretical_contribution_score: number
  confidence_score: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { paper_id, analysis_type = 'comprehensive', focus_areas = [], full_text }: DeepAnalysisRequest = await req.json()
    
    if (!paper_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: '缺少必需参数: paper_id' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 获取Supabase配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    const deepseekApiUrl = Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }
    
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_API_KEY', message: 'DeepSeek API密钥未配置' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始深度分析: paper_id=${paper_id}, type=${analysis_type}`)
    
    // 1. 检查是否已存在深度分析结果
    const { data: existingAnalysis, error: checkError } = await supabase
      .from('paper_deep_analysis')
      .select('*')
      .eq('paper_id', paper_id)
      .eq('analysis_status', 'completed')
      .maybeSingle()
    
    if (checkError) {
      console.error('检查现有分析失败:', checkError)
    } else if (existingAnalysis) {
      console.log('深度分析已存在，返回缓存结果')
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            analysis_id: existingAnalysis.id,
            cached: true,
            motivation: existingAnalysis.motivation,
            insights: existingAnalysis.insights,
            methods: existingAnalysis.methods,
            experiments: existingAnalysis.experiments,
            results: existingAnalysis.results,
            technical_novelty_score: existingAnalysis.technical_novelty_score,
            practical_impact_score: existingAnalysis.practical_impact_score,
            theoretical_contribution_score: existingAnalysis.theoretical_contribution_score,
            confidence_score: existingAnalysis.confidence_score
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 2. 获取论文基本信息
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('id, title, authors, abstract, doi, published_date, source_url, pdf_url')
      .eq('id', paper_id)
      .single()
    
    if (paperError || !paper) {
      throw new Error(`获取论文信息失败: ${paperError?.message || '论文不存在'}`)
    }
    
    console.log(`获取论文信息成功: ${paper.title}`)
    
    // 3. 获取全文内容（如果提供则使用，否则从数据库获取）
    let fullText = full_text
    if (!fullText) {
      const { data: fulltextData, error: fulltextError } = await supabase
        .from('paper_fulltext')
        .select('full_text')
        .eq('paper_id', paper_id)
        .maybeSingle()
      
      if (fulltextError) {
        console.warn('获取全文内容失败，将使用标题和摘要进行分析:', fulltextError)
        fullText = `${paper.title}\n\n${paper.abstract}`
      } else if (fulltextData) {
        fullText = fulltextData.full_text
        console.log(`获取全文内容成功: ${fullText.length} 字符`)
      } else {
        // 尝试从网页抓取全文
        try {
          const candidateUrl = paper.source_url || paper.pdf_url
          if (candidateUrl) {
            console.log(`尝试抓取原文: ${candidateUrl}`)
            const resp = await fetch(candidateUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
              }
            })
            if (resp.ok) {
              const contentType = resp.headers.get('content-type') || ''
              let text = ''
              if (contentType.includes('text/html')) {
                const html = await resp.text()
                text = htmlToText(html)
              } else {
                const readerUrl = `https://r.jina.ai/${candidateUrl}`
                const r = await fetch(readerUrl, { headers: { 'Accept': 'text/plain' } })
                if (r.ok) {
                  text = await r.text()
                }
              }
              if (text && text.length > 1000) {
                fullText = text
                console.log(`抓取原文成功: ${fullText.length} 字符`)
                await supabase
                  .from('paper_fulltext')
                  .upsert({ paper_id, full_text: fullText }, { onConflict: 'paper_id' })
              } else {
                console.warn('抓取原文失败或长度不足，回退到标题+摘要')
                fullText = `${paper.title}\n\n${paper.abstract}`
              }
            } else {
              console.warn('抓取原文失败，回退到标题+摘要')
              fullText = `${paper.title}\n\n${paper.abstract}`
            }
          } else {
            // 缺少原文链接时，尝试通过BioRxiv API的JATS路径获取全文
            const jatsText = await tryFetchJatsText(paper.doi)
            if (jatsText && jatsText.length > 1000) {
              fullText = jatsText
              console.log(`通过JATS获取原文成功: ${fullText.length} 字符`)
              await supabase
                .from('paper_fulltext')
                .upsert({ paper_id, full_text: fullText }, { onConflict: 'paper_id' })
            } else {
              console.log('缺少原文链接，使用标题和摘要进行分析')
              fullText = `${paper.title}\n\n${paper.abstract}`
            }
          }
        } catch (e) {
          console.warn('抓取原文异常，使用标题和摘要进行分析:', e)
          fullText = `${paper.title}\n\n${paper.abstract}`
        }
      }
    }
    
    // 4. 执行深度分析
    const startTime = Date.now()
    const analysisResult = await performDeepAnalysis(
      paper,
      fullText,
      analysis_type,
      focus_areas,
      deepseekApiKey,
      deepseekApiUrl
    )
    const processingTime = Date.now() - startTime
    
    console.log(`深度分析完成，耗时: ${processingTime}ms`)
    
    // 5. 存储分析结果
    const { data: analysisData, error: analysisError } = await supabase
      .from('paper_deep_analysis')
      .insert({
        paper_id,
        analysis_model: 'deepseek-chat',
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
        
        // 结构化分析结果
        motivation: analysisResult.motivation,
        insights: analysisResult.insights,
        methods: analysisResult.methods,
        experiments: analysisResult.experiments,
        results: analysisResult.results,
        
        // 评分
        technical_novelty_score: analysisResult.technical_novelty_score,
        practical_impact_score: analysisResult.practical_impact_score,
        theoretical_contribution_score: analysisResult.theoretical_contribution_score,
        confidence_score: analysisResult.confidence_score,
        
        // 处理信息
        processing_time: Math.ceil(processingTime / 1000),
        token_count: analysisResult.token_count || estimateTokenCount(fullText),
        analysis_type
      })
      .select()
      .single()
    
    if (analysisError) {
      throw new Error(`保存分析结果失败: ${analysisError.message}`)
    }
    
    console.log('深度分析结果保存成功')
    
    // 6. 记录分析统计
    await supabase.from('analysis_statistics').insert({
      analysis_type: 'deep_analysis',
      paper_id,
      model_used: 'deepseek-chat',
      token_consumed: analysisResult.token_count || estimateTokenCount(fullText),
      cost_usd: calculateAnalysisCost(analysisResult.token_count || estimateTokenCount(fullText)),
      processing_time: Math.ceil(processingTime / 1000),
      status: 'success'
    })
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          analysis_id: analysisData.id,
          token_count: analysisData.token_count,
          processing_time: analysisData.processing_time,
          motivation: analysisData.motivation,
          insights: analysisData.insights,
          methods: analysisData.methods,
          experiments: analysisData.experiments,
          results: analysisData.results,
          technical_novelty_score: analysisData.technical_novelty_score,
          practical_impact_score: analysisData.practical_impact_score,
          theoretical_contribution_score: analysisData.theoretical_contribution_score,
          confidence_score: analysisData.confidence_score
        },
        message: '深度分析完成'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('深度分析失败:', error)
    
    // 记录失败统计
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase.from('analysis_statistics').insert({
        analysis_type: 'deep_analysis',
        status: 'failed',
        error_type: error.message?.substring(0, 50) || 'unknown_error'
      })
    } catch (statsError) {
      console.error('记录失败统计失败:', statsError)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'DEEP_ANALYSIS_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function performDeepAnalysis(
  paper: any,
  fullText: string,
  analysisType: string,
  focusAreas: string[],
  apiKey: string,
  apiUrl: string
): Promise<DeepAnalysisResult & { token_count: number }> {
  
  // 根据分析类型构建不同的提示词
  const analysisPrompt = buildDeepAnalysisPrompt(paper, fullText, analysisType, focusAreas)
  
  console.log('构建深度分析提示词...')
  console.log(`分析类型: ${analysisType}`)
  console.log(`关注领域: ${focusAreas.join(', ') || '无特定要求'}`)
  
  // 估算token数量
  const estimatedTokens = estimateTokenCount(analysisPrompt + fullText)
  console.log(`预估token数量: ${estimatedTokens}`)
  
  // 如果文本过长，进行分段处理
  let comprehensiveAnalysis: string
  
  if (estimatedTokens > 32000) { // DeepSeek上下文限制
    console.log('文本过长，采用分段分析策略...')
    comprehensiveAnalysis = await analyzeLargeText(paper, fullText, analysisPrompt, apiKey, apiUrl)
  } else {
    console.log('执行单次深度分析...')
    comprehensiveAnalysis = await performSingleDeepAnalysis(analysisPrompt, apiKey, apiUrl)
  }
  
  // 解析分析结果
  const result = parseDeepAnalysisResult(comprehensiveAnalysis)
  result.token_count = estimatedTokens
  
  return result
}

function buildDeepAnalysisPrompt(paper: any, fullText: string, analysisType: string, focusAreas: string[]): string {
  
  // 计算安全的文本长度（为输出预留空间）
  // DeepSeek 上下文限制约 64K tokens
  // 系统提示 + 分析指令约占用 2000 tokens
  // 每个字符约 0.3-0.6 tokens，保守估计取 0.4
  // 预留 8000 tokens 给输出，所以输入限制为 54000 tokens ≈ 135000 字符
  const MAX_INPUT_CHARS = 135000
  const textToAnalyze = fullText.length > MAX_INPUT_CHARS 
    ? fullText.substring(0, MAX_INPUT_CHARS) + '\n\n[注：论文内容较长，以上为前135000字符的内容。分析基于这些主要内容进行。]'
    : fullText

  const basePrompt = `你是一位资深的学术分析师，专门分析生物医学领域的研究论文。请对以下论文进行深度、专业的学术分析。

论文基本信息：
标题：${paper.title}
作者：${paper.authors?.join(', ') || '未知'}
发表日期：${paper.published_date}
DOI：${paper.doi || '无'}

论文内容：
${textToAnalyze}

请按照以下结构进行详细分析，并以JSON格式返回结果：

{
  "motivation": "研究动机（200-300字）：\n- 研究背景：描述该研究领域的现状和存在的问题\n- 研究意义：说明这项研究的重要性和必要性\n- 研究目标：明确论文试图解决的核心科学问题",
  
  "insights": [
    "核心洞见1（100-150字）：描述最重要的理论或实践洞察",
    "核心洞见2（100-150字）：描述第二重要的发现或认识", 
    "核心洞见3（100-150字）：描述第三重要的创新性理解"
  ],
  
  "methods": {
    "overview": "方法概述（150-200字）：总结论文采用的核心方法论和技术路线",
    "key_techniques": [
      "关键技术1：详细描述最重要的技术方法",
      "关键技术2：描述第二重要的技术手段",
      "关键技术3：描述其他重要的技术方法"
    ],
    "innovations": [
      "方法创新1：描述在方法论上的创新之处",
      "方法创新2：描述在技术实现上的创新点",
      "方法创新3：描述在实验设计上的创新思路"
    ]
  },
  
  "experiments": {
    "design": "实验设计（150-200字）：详细描述实验的整体设计思路、对照组设置、变量控制等",
    "datasets": [
      "数据集1：描述使用的数据集特征、规模、来源",
      "数据集2：描述验证使用的其他数据集"
    ],
    "metrics": [
      "评估指标1：描述主要的性能评估指标",
      "评估指标2：描述辅助的评估指标",
      "评估指标3：描述统计显著性检验方法"
    ],
    "baselines": [
      "基线方法1：描述用于对比的现有最佳方法",
      "基线方法2：描述其他重要的对比方法"
    ]
  },
  
  "results": {
    "main_findings": [
      "主要发现1：详细描述最重要的实验结果",
      "主要发现2：描述第二重要的实验发现",
      "主要发现3：描述其他重要的实验结果"
    ],
    "performance_gains": [
      "性能提升1：量化描述相比基线方法的改进幅度",
      "性能提升2：描述在其他指标上的改进",
      "性能提升3：描述在特定条件下的优势表现"
    ],
    "significance": "结果意义（100-150字）：解释这些结果对领域发展的重要意义",
    "limitations": [
      "局限性1：客观分析研究存在的不足或限制",
      "局限性2：描述方法适用范围的限制",
      "局限性3：指出实验设计中的潜在问题"
    ]
  },
  
  "technical_novelty_score": 8.5, // 技术新颖性评分（0-10分，保留1位小数）
  "practical_impact_score": 7.8, // 实际应用影响评分（0-10分，保留1位小数）
  "theoretical_contribution_score": 8.2, // 理论贡献评分（0-10分，保留1位小数）
  "confidence_score": 8.7 // 分析置信度评分（0-10分，保留1位小数）
}

 

分析要求：
1. **客观性**：严格基于论文实际内容进行分析，避免主观臆断
2. **专业性**：使用准确的学术术语，体现对领域的深入理解
3. **深度性**：不仅描述表面现象，更要挖掘深层含义和影响
4. **结构性**：严格按照JSON格式返回，确保数据可解析
5. **实用性**：提供对研究人员有实际指导价值的分析见解

特别关注领域：${focusAreas.length > 0 ? focusAreas.join(', ') : '全面分析'}

分析类型：${analysisType === 'quick' ? '快速分析' : analysisType === 'focused' ? '聚焦分析' : '全面深度分析'}`

  return basePrompt
}

async function tryFetchJatsText(doi: string): Promise<string | null> {
  try {
    const server = doi?.startsWith('10.1101/') ? 'biorxiv' : 'medrxiv'
    const metaResp = await fetch(`https://api.biorxiv.org/details/${server}/${encodeURIComponent(doi)}/na/json`)
    if (!metaResp.ok) return null
    const meta = await metaResp.json()
    const item = (meta?.collection && meta.collection[0]) ? meta.collection[0] : null
    if (!item) return null
    const jatsPathKey = Object.keys(item).find(k => k.toLowerCase().includes('jats'))
    const jatsPath = jatsPathKey ? item[jatsPathKey] : null
    if (!jatsPath || typeof jatsPath !== 'string') return null
    const jatsUrl = jatsPath.startsWith('http') ? jatsPath : `https://www.${server}.org${jatsPath}`
    const jatsResp = await fetch(jatsUrl, { headers: { 'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8' } })
    if (jatsResp.ok) {
      const xml = await jatsResp.text()
      return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    const readerResp = await fetch(`https://r.jina.ai/${jatsUrl}`, { headers: { 'Accept': 'text/plain' } })
    if (readerResp.ok) {
      const txt = await readerResp.text()
      return txt?.trim() || null
    }
    return null
  } catch {
    return null
  }
}

function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = withoutScripts.replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

async function performSingleDeepAnalysis(prompt: string, apiKey: string, apiUrl: string): Promise<string> {
  console.log('执行单次深度分析...')
  
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位资深的学术分析师，专门分析生物医学领域的研究论文。请严格按照JSON格式返回分析结果，确保所有字段都完整填写。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API调用失败: ${response.status} ${errorText}`)
  }
  
  const result: DeepSeekResponse = await response.json()
  return result.choices[0].message.content
}

async function analyzeLargeText(paper: any, fullText: string, basePrompt: string, apiKey: string, apiUrl: string): Promise<string> {
  console.log('执行大文本分段分析...')
  
  // 将文本分成几个主要部分：引言、方法、结果、讨论
  const sections = extractMainSections(fullText)
  const partialAnalyses = []
  
  // 对每个部分进行分析
  const sectionOrder = ['introduction', 'methods', 'results', 'discussion', 'conclusion']
  
  for (const sectionName of sectionOrder) {
    const sectionContent = sections[sectionName]
    if (sectionContent && sectionContent.length > 100) {
      console.log(`分析${sectionName}部分...`)
      
      const sectionPrompt = `请重点分析以下论文${sectionName}部分的内容：\n\n${sectionContent.substring(0, 5000)}\n\n请提供针对这一部分的详细分析。`
      
      const sectionAnalysis = await performSingleDeepAnalysis(sectionPrompt, apiKey, apiUrl)
      partialAnalyses.push({
        section: sectionName,
        analysis: sectionAnalysis
      })
    }
  }
  
  // 综合所有部分的分析结果
  const synthesisPrompt = `基于以下各部分的分析结果，请综合生成完整的论文分析报告：\n\n${JSON.stringify(partialAnalyses, null, 2)}\n\n论文基本信息：\n标题：${paper.title}\n\n请确保最终的分析报告涵盖整篇论文的所有重要方面，并按照之前要求的JSON格式返回。`
  
  return await performSingleDeepAnalysis(synthesisPrompt, apiKey, apiUrl)
}

function extractMainSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lowerText = text.toLowerCase()
  
  // 定义章节标题的模式
  const patterns = {
    introduction: /introduction|背景|引言|简介/i,
    methods: /methods?|materials?\s+and\s+methods?|实验方法|方法|methodology/i,
    results: /results?|结果|研究发现|实验结果/i,
    discussion: /discussion|讨论|分析|评述/i,
    conclusion: /conclusion|conclusions|结论|总结|展望/i
  }
  
  let currentSection = ''
  let currentContent = ''
  const lines = text.split('\n')
  
  for (const line of lines) {
    let matched = false
    
    for (const [sectionName, pattern] of Object.entries(patterns)) {
      if (pattern.test(line.trim()) && line.trim().length < 50) {
        // 保存前一个章节
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

function parseDeepAnalysisResult(content: string): DeepAnalysisResult {
  try {
    // 尝试解析JSON格式的结果
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // 验证必要字段
      if (parsed.motivation && parsed.insights && parsed.methods && parsed.experiments && parsed.results) {
        return {
          motivation: parsed.motivation || '',
          insights: Array.isArray(parsed.insights) ? parsed.insights : [],
          methods: {
            overview: parsed.methods.overview || '',
            key_techniques: Array.isArray(parsed.methods.key_techniques) ? parsed.methods.key_techniques : [],
            innovations: Array.isArray(parsed.methods.innovations) ? parsed.methods.innovations : []
          },
          experiments: {
            design: parsed.experiments.design || '',
            datasets: Array.isArray(parsed.experiments.datasets) ? parsed.experiments.datasets : [],
            metrics: Array.isArray(parsed.experiments.metrics) ? parsed.experiments.metrics : [],
            baselines: Array.isArray(parsed.experiments.baselines) ? parsed.experiments.baselines : []
          },
          results: {
            main_findings: Array.isArray(parsed.results.main_findings) ? parsed.results.main_findings : [],
            performance_gains: Array.isArray(parsed.results.performance_gains) ? parsed.results.performance_gains : [],
            significance: parsed.results.significance || '',
            limitations: Array.isArray(parsed.results.limitations) ? parsed.results.limitations : []
          },
          technical_novelty_score: parseFloat(parsed.technical_novelty_score) || 5.0,
          practical_impact_score: parseFloat(parsed.practical_impact_score) || 5.0,
          theoretical_contribution_score: parseFloat(parsed.theoretical_contribution_score) || 5.0,
          confidence_score: parseFloat(parsed.confidence_score) || 5.0
        }
      }
    }
    
    throw new Error('分析结果格式不完整')
    
  } catch (error) {
    console.error('解析深度分析结果失败:', error)
    
    // 返回默认结构
    return {
      motivation: '分析结果解析失败',
      insights: ['需要手动检查分析结果'],
      methods: {
        overview: '方法概述提取失败',
        key_techniques: [],
        innovations: []
      },
      experiments: {
        design: '实验设计提取失败',
        datasets: [],
        metrics: [],
        baselines: []
      },
      results: {
        main_findings: [],
        performance_gains: [],
        significance: '结果意义提取失败',
        limitations: []
      },
      technical_novelty_score: 5.0,
      practical_impact_score: 5.0,
      theoretical_contribution_score: 5.0,
      confidence_score: 3.0
    }
  }
}

function estimateTokenCount(text: string): number {
  // 粗略估算：中文字符按0.6token，英文字符按0.3token计算
  let chineseCount = 0
  let englishCount = 0
  
  for (const char of text) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      chineseCount++
    } else if (/[a-zA-Z]/.test(char)) {
      englishCount++
    }
  }
  
  return Math.ceil(chineseCount * 0.6 + englishCount * 0.3)
}

function calculateAnalysisCost(tokenCount: number): number {
  // DeepSeek定价：$0.14 per 1M input tokens, $0.28 per 1M output tokens
  // 假设输入输出比例约为3:1
  const inputTokens = Math.ceil(tokenCount * 0.75)
  const outputTokens = Math.ceil(tokenCount * 0.25)
  
  const inputCost = (inputTokens / 1000000) * 0.14
  const outputCost = (outputTokens / 1000000) * 0.28
  
  return inputCost + outputCost
}
