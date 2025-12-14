import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface FullTextAnalysisRequest {
  paper_id: string
  fulltext_id: string
  analysis_type?: 'comprehensive' | 'quick' | 'focused'
  focus_areas?: string[] // 可选：指定关注的分析领域
}

interface MiniMaxResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface AnalysisResult {
  executive_summary: string
  key_findings: string[]
  technical_contributions: string[]
  methodology_summary: string
  results_summary: string
  novelty_score: number
  technical_depth_score: number
  reproducibility_score: number
  research_questions: string[]
  hypotheses: string[]
  experimental_design: Record<string, any>
  statistical_methods: string[]
  citation_network: Record<string, any>
  related_works: Record<string, any>
  research_gaps: string[]
  future_directions: string[]
  confidence_score: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { paper_id, fulltext_id, analysis_type = 'comprehensive', focus_areas = [] }: FullTextAnalysisRequest = await req.json()
    
    if (!paper_id || !fulltext_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: '缺少必需参数: paper_id 和 fulltext_id' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 获取Supabase配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const minimaxApiKey = Deno.env.get('MINIMAX_API_KEY')
    const minimaxApiUrl = Deno.env.get('MINIMAX_API_URL') || 'https://api.minimax.chat/v1/text/chatcompletion'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }
    
    if (!minimaxApiKey) {
      throw new Error('缺少MiniMax API密钥配置')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始全文分析: paper_id=${paper_id}, fulltext_id=${fulltext_id}, type=${analysis_type}`)
    
    // 1. 获取全文内容
    const { data: fulltext, error: ftError } = await supabase
      .from('paper_fulltext')
      .select('*')
      .eq('id', fulltext_id)
      .single()
    
    if (ftError || !fulltext) {
      throw new Error(`获取全文内容失败: ${ftError?.message || '全文不存在'}`)
    }
    
    console.log(`获取全文内容成功: ${fulltext.word_count} 字, ${fulltext.page_count} 页`)
    
    // 2. 获取论文基本信息
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('title, authors, abstract, doi')
      .eq('id', paper_id)
      .single()
    
    if (paperError || !paper) {
      throw new Error(`获取论文信息失败: ${paperError?.message || '论文不存在'}`)
    }
    
    // 3. 执行全文分析
    const startTime = Date.now()
    const analysisResult = await analyzeWithMiniMax(
      fulltext.full_text,
      paper,
      analysis_type,
      focus_areas,
      minimaxApiKey,
      minimaxApiUrl
    )
    const processingTime = Date.now() - startTime
    
    console.log(`MiniMax分析完成，耗时: ${processingTime}ms`)
    
    // 4. 存储分析结果
    const { data: analysisData, error: analysisError } = await supabase
      .from('paper_fulltext_analysis')
      .insert({
        paper_id,
        fulltext_id,
        ...analysisResult,
        analysis_model: 'MiniMax-Text-01',
        token_count: estimateTokenCount(fulltext.full_text),
        processing_time: Math.ceil(processingTime / 1000),
        confidence_score: analysisResult.confidence_score
      })
      .select()
      .single()
    
    if (analysisError) {
      throw new Error(`保存分析结果失败: ${analysisError.message}`)
    }
    
    console.log('全文分析结果保存成功')
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          analysis_id: analysisData.id,
          token_count: analysisData.token_count,
          processing_time: analysisData.processing_time,
          confidence_score: analysisData.confidence_score,
          key_findings_count: analysisResult.key_findings.length,
          technical_contributions_count: analysisResult.technical_contributions.length
        },
        message: '全文分析完成'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('全文分析失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'FULLTEXT_ANALYSIS_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function analyzeWithMiniMax(
  fullText: string,
  paper: any,
  analysisType: string,
  focusAreas: string[],
  apiKey: string,
  apiUrl: string
): Promise<AnalysisResult> {
  
  // 根据分析类型构建不同的提示词
  const prompt = buildAnalysisPrompt(fullText, paper, analysisType, focusAreas)
  
  // 估算token数量（粗略估计：1个中文字符≈0.6token，1个英文字符≈0.3token）
  const estimatedTokens = estimateTokenCount(fullText)
  console.log(`预估token数量: ${estimatedTokens}`)
  
  // 如果文本过长，进行分段处理
  let comprehensiveAnalysis = ''
  
  if (estimatedTokens > 3800000) { // 接近400万token上限
    // 超长篇论文，采用分层摘要策略
    comprehensiveAnalysis = await analyzeLargePaper(fullText, paper, apiKey, apiUrl)
  } else {
    // 普通长度论文，一次性分析
    comprehensiveAnalysis = await performSingleAnalysis(fullText, prompt, apiKey, apiUrl)
  }
  
  // 解析分析结果
  return parseAnalysisResult(comprehensiveAnalysis)
}

function buildAnalysisPrompt(fullText: string, paper: any, analysisType: string, focusAreas: string[]): string {
  const basePrompt = `你是一位资深的学术分析师，拥有丰富的科研经验。请对以下学术论文进行专业、全面、深入的分析。

论文基本信息：
标题：${paper.title}
作者：${paper.authors?.join(', ') || '未知'}
DOI：${paper.doi || '无'}

论文全文内容：
${fullText}

请按照以下要求进行结构化分析，并以JSON格式返回结果：

{
  "executive_summary": "用简洁易懂的语言总结论文的核心贡献，适合非专业读者理解（200-300字）",
  "key_findings": [
    "最重要的研究发现1",
    "最重要的研究发现2",
    "最重要的研究发现3"
  ],
  "technical_contributions": [
    "具体的技术创新点1",
    "具体的技术创新点2",
    "具体的技术创新点3"
  ],
  "methodology_summary": "总结论文采用的研究方法和技术路线（150-200字）",
  "results_summary": "总结论文的主要实验结果和发现（150-200字）",
  "novelty_score": 8.5, // 创新性评分（0-10分，保留1位小数）
  "technical_depth_score": 7.8, // 技术深度评分（0-10分，保留1位小数）
  "reproducibility_score": 6.9, // 可复现性评分（0-10分，保留1位小数）
  "research_questions": [
    "论文试图解决的核心研究问题1",
    "论文试图解决的核心研究问题2"
  ],
  "hypotheses": [
    "论文提出的主要假设1",
    "论文提出的主要假设2"
  ],
  "experimental_design": {
    "type": "实验类型（如：对照实验、观察性研究、模拟实验等）",
    "sample_size": "样本规模",
    "variables": ["自变量1", "因变量1", "控制变量1"],
    "methods": ["采用的具体实验方法1", "采用的具体实验方法2"]
  },
  "statistical_methods": [
    "使用的统计方法1",
    "使用的统计方法2"
  ],
  "citation_network": {
    "key_references": ["重要参考文献1", "重要参考文献2"],
    "citation_count_estimate": "预估引用数量范围"
  },
  "related_works": {
    "similar_studies": ["类似研究1", "类似研究2"],
    "different_approaches": ["不同方法的研究1", "不同方法的研究2"]
  },
  "research_gaps": [
    "当前研究存在的空白1",
    "当前研究存在的空白2",
    "当前研究存在的空白3"
  ],
  "future_directions": [
    "有价值的未来研究方向1",
    "有价值的未来研究方向2",
    "有价值的未来研究方向3"
  ],
  "confidence_score": 8.7 // 整体分析置信度（0-10分，保留1位小数）
}

分析要求：
1. 客观性：基于论文实际内容进行分析，避免主观臆断
2. 专业性：使用准确的学术术语和概念
3. 全面性：覆盖论文的技术、创新、影响等各个维度
4. 实用性：提供对研究人员有价值的洞察和建议
5. 结构化：严格按照JSON格式返回，确保数据可解析`

  return basePrompt
}

async function performSingleAnalysis(text: string, prompt: string, apiKey: string, apiUrl: string): Promise<string> {
  console.log('执行单次全文分析...')
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [
        { role: 'system', content: '你是一位资深的学术分析师，专门分析生物医学领域的研究论文。请严格按照JSON格式返回分析结果。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.3,
      top_p: 0.9
    })
  })
  
  if (!response.ok) {
    throw new Error(`MiniMax API调用失败: ${response.status}`)
  }
  
  const result: MiniMaxResponse = await response.json()
  return result.choices[0].message.content
}

async function analyzeLargePaper(text: string, paper: any, apiKey: string, apiUrl: string): Promise<string> {
  console.log('执行超长篇论文分层分析...')
  
  // 将超长文本分成多个部分进行分层摘要
  const chunkSize = 1000000 // 每部分约100万字符
  const chunks = []
  
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize))
  }
  
  console.log(`论文分为 ${chunks.length} 个部分进行分析`)
  
  // 对每个部分进行分析
  const partialAnalyses = []
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`分析第 ${i + 1} 部分...`)
    
    const chunkPrompt = `这是论文的第 ${i + 1} 部分（共 ${chunks.length} 部分）：\n\n${chunks[i]}\n\n请提供这部分的详细分析，包括关键发现、技术贡献和重要性评估。`
    
    const partialAnalysis = await performSingleAnalysis(chunks[i], chunkPrompt, apiKey, apiUrl)
    partialAnalyses.push(partialAnalysis)
  }
  
  // 综合所有部分的分析结果
  const synthesisPrompt = `基于以下各部分的分析结果，请综合生成完整的论文分析报告：\n\n${partialAnalyses.join('\n\n---\n\n')}\n\n请确保最终的分析涵盖整篇论文的所有重要方面。`
  
  return await performSingleAnalysis('', synthesisPrompt, apiKey, apiUrl)
}

function parseAnalysisResult(content: string): AnalysisResult {
  try {
    // 尝试解析JSON格式的结果
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // 如果无法解析JSON，返回结构化数据
    return {
      executive_summary: extractSection(content, 'executive_summary', '执行摘要'),
      key_findings: extractList(content, 'key_findings', '关键发现'),
      technical_contributions: extractList(content, 'technical_contributions', '技术贡献'),
      methodology_summary: extractSection(content, 'methodology_summary', '方法学总结'),
      results_summary: extractSection(content, 'results_summary', '结果总结'),
      novelty_score: extractScore(content, 'novelty_score', '创新性评分'),
      technical_depth_score: extractScore(content, 'technical_depth_score', '技术深度评分'),
      reproducibility_score: extractScore(content, 'reproducibility_score', '可复现性评分'),
      research_questions: extractList(content, 'research_questions', '研究问题'),
      hypotheses: extractList(content, 'hypotheses', '假设'),
      experimental_design: extractObject(content, 'experimental_design', '实验设计'),
      statistical_methods: extractList(content, 'statistical_methods', '统计方法'),
      citation_network: extractObject(content, 'citation_network', '引用网络'),
      related_works: extractObject(content, 'related_works', '相关工作'),
      research_gaps: extractList(content, 'research_gaps', '研究空白'),
      future_directions: extractList(content, 'future_directions', '未来方向'),
      confidence_score: extractScore(content, 'confidence_score', '置信度评分')
    }
    
  } catch (error) {
    console.error('解析分析结果失败:', error)
    
    // 返回默认结构
    return {
      executive_summary: content.substring(0, 500),
      key_findings: ['分析结果解析失败'],
      technical_contributions: ['需要手动检查分析结果'],
      methodology_summary: '',
      results_summary: '',
      novelty_score: 5.0,
      technical_depth_score: 5.0,
      reproducibility_score: 5.0,
      research_questions: [],
      hypotheses: [],
      experimental_design: {},
      statistical_methods: [],
      citation_network: {},
      related_works: {},
      research_gaps: [],
      future_directions: [],
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

// 辅助函数：从文本中提取各种信息
function extractSection(text: string, field: string, label: string): string {
  const pattern = new RegExp(`"${field}":\\s*"([^"]*)"`, 'i')
  const match = text.match(pattern)
  return match ? match[1] : `${label}提取失败`
}

function extractList(text: string, field: string, label: string): string[] {
  const pattern = new RegExp(`"${field}":\\s*\\[([^\\]]*)\\]`, 'i')
  const match = text.match(pattern)
  if (match) {
    try {
      return JSON.parse(`[${match[1]}]`)
    } catch {
      return match[1].split(',').map(item => item.trim().replace(/^"|"$/g, ''))
    }
  }
  return []
}

function extractScore(text: string, field: string, label: string): number {
  const pattern = new RegExp(`"${field}":\\s*([0-9]+\\.?[0-9]*)`, 'i')
  const match = text.match(pattern)
  return match ? parseFloat(match[1]) : 5.0
}

function extractObject(text: string, field: string, label: string): Record<string, any> {
  const pattern = new RegExp(`"${field}":\\s*(\\{[^}]*\\})`, 'i')
  const match = text.match(pattern)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {
      return {}
    }
  }
  return {}
}