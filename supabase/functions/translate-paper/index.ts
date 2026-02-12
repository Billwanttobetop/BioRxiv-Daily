import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

interface TranslationRequest {
  paper_id: string
  title: string
  abstract: string
  priority?: number
  force?: boolean
}

interface TranslationResult {
  title_cn: string
  abstract_cn: string
  main_institutions: string[]
  tags: string[]
  translation_cost: number
  token_count: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { paper_id, title, abstract, priority = 1, force = false }: TranslationRequest = await req.json()
    
    if (!paper_id || !title || !abstract) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: '缺少必需参数: paper_id, title, abstract' }
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
      console.warn('缺少DeepSeek API密钥，跳过翻译')
      return new Response(
        JSON.stringify({
          success: true,
          data: { skipped: true, reason: 'API密钥未配置' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始翻译论文: ${paper_id}`)
    console.log(`原文标题: ${title}`)
    console.log(`原文摘要: ${abstract.substring(0, 200)}...`)
    
    // 检查是否已存在翻译结果
    const { data: existingAnalysis, error: checkError } = await supabase
      .from('paper_analysis')
      .select('id, title_cn, abstract_cn, translation_status')
      .eq('paper_id', paper_id)
      .maybeSingle()
    
    if (checkError) {
      console.error('检查现有翻译失败:', checkError)
    } else if (!force && existingAnalysis && existingAnalysis.translation_status === 'completed') {
      console.log('翻译已存在且未开启强制模式，跳过处理')
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            cached: true,
            title_cn: existingAnalysis.title_cn,
            abstract_cn: existingAnalysis.abstract_cn
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 更新翻译状态为处理中
    await supabase
      .from('paper_analysis')
      .upsert({
        paper_id,
        translation_status: 'processing',
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })
    
    // 执行翻译
    const startTime = Date.now()
    const translationResult = await performTranslation(
      title,
      abstract,
      deepseekApiKey,
      deepseekApiUrl
    )
    const processingTime = Date.now() - startTime
    
    console.log(`翻译完成，耗时: ${processingTime}ms`)
    console.log(`翻译后标题: ${translationResult.title_cn}`)
    console.log(`翻译后摘要: ${translationResult.abstract_cn.substring(0, 200)}...`)
    console.log(`生成标签: ${(translationResult.tags || []).join(', ')}`)

    if (translationResult.tags && translationResult.tags.length > 0) {
      await saveTagsForPaper(supabase, paper_id, translationResult.tags)
    }
    
    // 更新翻译结果
    const { error: updateError } = await supabase
      .from('paper_analysis')
      .upsert({
        paper_id,
        title_cn: translationResult.title_cn,
        abstract_cn: translationResult.abstract_cn,
        main_institutions: translationResult.main_institutions,
        translation_model: 'deepseek-chat',
        translation_cost: translationResult.translation_cost,
        translation_status: 'completed',
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })
    
    if (updateError) {
      throw new Error(`更新翻译结果失败: ${updateError.message}`)
    }
    
    // 记录分析统计
    await supabase.from('analysis_statistics').insert({
      analysis_type: 'translation',
      paper_id,
      model_used: 'deepseek-chat',
      token_consumed: translationResult.token_count,
      cost_usd: translationResult.translation_cost,
      processing_time: Math.ceil(processingTime / 1000),
      status: 'success'
    })
    
    console.log('翻译结果保存成功')
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title_cn: translationResult.title_cn,
          abstract_cn: translationResult.abstract_cn,
          main_institutions: translationResult.main_institutions,
          translation_cost: translationResult.translation_cost,
          token_count: translationResult.token_count,
          processing_time
        },
        message: '翻译完成'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('翻译失败:', error)
    
    // 记录失败统计
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase.from('analysis_statistics').insert({
        analysis_type: 'translation',
        status: 'failed',
        error_type: error.message?.substring(0, 50) || 'unknown_error'
      })
      
      // 更新翻译状态为失败
      const { paper_id } = await req.json().catch(() => ({ paper_id: null }))
      if (paper_id) {
        await supabase
          .from('paper_analysis')
          .upsert({
            paper_id,
            translation_status: 'failed',
            analyzed_at: new Date().toISOString()
          }, {
            onConflict: 'paper_id'
          })
      }
    } catch (statsError) {
      console.error('记录失败统计失败:', statsError)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'TRANSLATION_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function performTranslation(
  title: string,
  abstract: string,
  apiKey: string,
  apiUrl: string
): Promise<TranslationResult> {
  
  const translationPrompt = `你是一位专业的学术翻译专家，专门翻译生物医学领域的学术论文。

请将以下英文论文标题和摘要翻译成中文，并提取3-5个“泛化一级主题标签”（中文、学科/领域上位词，避免过细名词）。
要求：准确、规范、术语一致，摘要完整流畅。

英文标题：${title}

英文摘要：${abstract}

请返回如下JSON：
{
  "title_cn": "中文标题",
  "abstract_cn": "中文摘要",
  "main_institutions": ["主要研究机构1"],
  "tags": ["标签1", "标签2", "标签3"]
}`

  console.log('调用DeepSeek API进行翻译...')
  
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
          content: '你是一位专业的学术翻译专家，擅长将论文准确翻译并提取主题标签。请严格按照JSON对象返回结果。'
        },
        {
          role: 'user',
          content: translationPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API调用失败: ${response.status} ${errorText}`)
  }
  
  const result: DeepSeekResponse = await response.json()
  const translatedContent = result.choices[0].message.content
  
  console.log('DeepSeek API响应:', translatedContent)
  
  // 解析JSON格式的翻译结果
  let parsedResult: TranslationResult
  try {
    parsedResult = JSON.parse(translatedContent)
    
    // 验证结果格式
    if (!parsedResult.title_cn || !parsedResult.abstract_cn) {
      throw new Error('翻译结果格式不完整')
    }
    
    // 确保main_institutions是数组
    if (!Array.isArray(parsedResult.main_institutions)) {
      parsedResult.main_institutions = []
    }
    if (!Array.isArray(parsedResult.tags)) {
      parsedResult.tags = []
    }
    
  } catch (parseError) {
    console.error('解析翻译结果失败，使用备用方案:', parseError)
    
    // 备用方案：手动提取翻译内容
    const titleMatch = translatedContent.match(/"title_cn":\s*"([^"]+)"/)
    const abstractMatch = translatedContent.match(/"abstract_cn":\s*"([^"]+)"/)
    
    if (!titleMatch || !abstractMatch) {
      throw new Error('无法从API响应中提取翻译内容')
    }
    
    parsedResult = {
      title_cn: titleMatch[1],
      abstract_cn: abstractMatch[1],
      main_institutions: [],
      tags: []
    }
  }
  
  // 估算token数量和成本
  const inputTokens = estimateTokens(title + ' ' + abstract)
  const outputTokens = estimateTokens(parsedResult.title_cn + ' ' + parsedResult.abstract_cn)
  const totalTokens = inputTokens + outputTokens
  
  // DeepSeek定价：$0.14 per 1M input tokens, $0.28 per 1M output tokens
  const inputCost = (inputTokens / 1000000) * 0.14
  const outputCost = (outputTokens / 1000000) * 0.28
  const totalCost = inputCost + outputCost
  
  console.log(`翻译token统计: 输入${inputTokens}, 输出${outputTokens}, 总成本$${totalCost.toFixed(6)}`)
  
  return {
    ...parsedResult,
    translation_cost: totalCost,
    token_count: totalTokens
  }
}

function estimateTokens(text: string): number {
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

async function saveTagsForPaper(supabase: any, paperId: string, tagNames: string[]) {
  const names = Array.from(new Set((tagNames || []).map(n => (n || '').trim()).filter(Boolean)))
  for (const name of names) {
    try {
      const { data: existing } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
      let tagId = existing?.id
      if (!tagId) {
        const { data: inserted } = await supabase
          .from('tags')
          .upsert({ name }, { onConflict: 'name' })
          .select('id')
          .single()
        tagId = inserted?.id
      }
      if (!tagId) continue
      const { data: rel } = await supabase
        .from('paper_tags')
        .select('id')
        .eq('paper_id', paperId)
        .eq('tag_id', tagId)
        .maybeSingle()
      if (!rel) {
        await supabase.from('paper_tags').insert({ paper_id: paperId, tag_id: tagId })
      }
    } catch (e) {
      console.error('saveTagsForPaper error', e)
    }
  }
}
