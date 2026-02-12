import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// 队列处理配置 - 优化DeepSeek并行处理
const BATCH_SIZE = 20 // 每批处理的翻译任务数量（增加到20）
const MAX_CONCURRENT_REQUESTS = 10 // 最大并发请求数
const API_TIMEOUT = 30000 // DeepSeek API调用超时时间（30秒）

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('开始处理翻译队列（DeepSeek并行模式）...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    const deepseekApiUrl = Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1'
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }

    if (!deepseekApiKey) {
      throw new Error('缺少DeepSeek API配置')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 获取待处理的翻译任务
    const { data: pendingTasks, error: fetchError } = await supabase
      .from('translation_queue')
      .select('id, paper_id, priority, retry_count')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`获取翻译任务失败: ${fetchError.message}`)
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      console.log('没有待处理的翻译任务')
      return new Response(
        JSON.stringify({
          success: true,
          data: { processed: 0, message: '没有待处理的任务' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`获取到 ${pendingTasks.length} 个翻译任务`)

    // 更新任务状态为处理中
    const taskIds = pendingTasks.map(task => task.id)
    const { error: updateError } = await supabase
      .from('translation_queue')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .in('id', taskIds)

    if (updateError) {
      throw new Error(`更新任务状态失败: ${updateError.message}`)
    }

    // 使用并发控制处理翻译任务（DeepSeek多线程）
    const results = []
    for (let i = 0; i < pendingTasks.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = pendingTasks.slice(i, i + MAX_CONCURRENT_REQUESTS)
      console.log(`处理第 ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1} 批任务，共 ${batch.length} 个（并发调用DeepSeek）`)
      
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          try {
            return await processTranslationTask(
              task, 
              supabase, 
              deepseekApiKey, 
              deepseekApiUrl
            )
          } catch (error) {
            console.error(`处理任务 ${task.id} 失败:`, error)
            return {
              taskId: task.id,
              success: false,
              error: error.message
            }
          }
        })
      )
      
      results.push(...batchResults)
      
      // 批次之间添加短暂延迟，避免API过载
      if (i + MAX_CONCURRENT_REQUESTS < pendingTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // 统计处理结果
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    console.log(`翻译队列处理完成: 成功 ${successful}, 失败 ${failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          processed: pendingTasks.length,
          successful,
          failed,
          results: results.map((result, index) => ({
            taskId: pendingTasks[index].id,
            paperId: pendingTasks[index].paper_id,
            success: result.status === 'fulfilled' ? result.value.success : false,
            error: result.status === 'rejected' ? result.reason.message : (result.value?.error || null)
          }))
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('处理翻译队列失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'QUEUE_PROCESSING_ERROR',
          message: error.message,
          details: error.stack
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function processTranslationTask(
  task: any, 
  supabase: any, 
  apiKey: string, 
  apiUrl: string
) {
  const startTime = Date.now()
  
  try {
    console.log(`开始处理翻译任务: ${task.id}, 论文ID: ${task.paper_id}`)
    
    // 获取论文信息
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('id, title, abstract, authors')
      .eq('id', task.paper_id)
      .single()

    if (paperError) {
      throw new Error(`获取论文信息失败: ${paperError.message}`)
    }

    if (!paper) {
      throw new Error('论文不存在')
    }

    console.log(`获取论文信息成功: ${paper.title.substring(0, 50)}...`)

    // 检查是否已存在翻译
    const { data: existingAnalysis } = await supabase
      .from('paper_analysis')
      .select('id, title_cn, abstract_cn, translation_status')
      .eq('paper_id', task.paper_id)
      .maybeSingle()
    
    if (existingAnalysis && existingAnalysis.translation_status === 'completed') {
      console.log(`论文 ${task.paper_id} 已有翻译，跳过`)
      await markTaskCompleted(supabase, task.id)
      
      return {
        taskId: task.id,
        paperId: task.paper_id,
        success: true,
        skipped: true
      }
    }

    // 使用DeepSeek进行翻译
    const translationResult = await translateWithDeepSeek(
      paper.title,
      paper.abstract,
      apiKey,
      apiUrl
    )
    
    if (!translationResult.success) {
      throw new Error(`翻译失败: ${translationResult.error}`)
    }

    // 更新论文分析表
    const { error: updateError } = await supabase
      .from('paper_analysis')
      .upsert({
        paper_id: task.paper_id,
        title_cn: translationResult.title_cn,
        abstract_cn: translationResult.abstract_cn,
        main_institutions: translationResult.main_institutions,
        translation_model: 'deepseek-chat',
        translation_cost: translationResult.cost,
        translation_status: 'completed',
        translated_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })

    if (updateError) {
      throw new Error(`更新翻译结果失败: ${updateError.message}`)
    }

    // 保存标签
    if (translationResult.tags && translationResult.tags.length > 0) {
      await saveTagsForPaper(supabase, task.paper_id, translationResult.tags)
    }

    // 更新任务状态为完成
    await markTaskCompleted(supabase, task.id)

    const processingTime = Date.now() - startTime
    console.log(`翻译任务完成: ${task.id}, 耗时: ${processingTime}ms`)

    return {
      taskId: task.id,
      paperId: task.paper_id,
      success: true,
      processingTime
    }

  } catch (error) {
    console.error(`翻译任务失败: ${task.id}`, error)
    
    // 判断是否需要重试
    if (task.retry_count < 3) {
      console.log(`任务 ${task.id} 将重试，当前重试次数: ${task.retry_count}`)
      
      await supabase
        .from('translation_queue')
        .update({
          status: 'pending',
          retry_count: task.retry_count + 1,
          error_message: error.message.substring(0, 500),
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
      
      return {
        taskId: task.id,
        paperId: task.paper_id,
        success: false,
        error: error.message,
        willRetry: true
      }
    } else {
      // 标记为失败
      await supabase
        .from('translation_queue')
        .update({
          status: 'failed',
          error_message: error.message.substring(0, 500),
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
      
      return {
        taskId: task.id,
        paperId: task.paper_id,
        success: false,
        error: error.message,
        willRetry: false
      }
    }
  }
}

async function translateWithDeepSeek(
  title: string,
  abstract: string,
  apiKey: string,
  apiUrl: string
): Promise<any> {
  try {
    const translationPrompt = `你是一位专业的学术翻译专家，专门翻译生物医学领域的学术论文。

请将以下英文论文标题和摘要翻译成中文，并提取3-5个"泛化一级主题标签"（中文、学科/领域上位词，避免过细名词）。
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
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
    
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
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API调用失败: ${response.status} ${errorText}`)
    }
    
    const result = await response.json()
    const translatedContent = result.choices[0].message.content
    
    console.log('DeepSeek API响应成功')
    
    // 解析JSON格式的翻译结果
    let parsedResult: any
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
    
    // DeepSeek定价：$0.14 per 1M input tokens, $0.28 per 1M output tokens
    const inputCost = (inputTokens / 1000000) * 0.14
    const outputCost = (outputTokens / 1000000) * 0.28
    const totalCost = inputCost + outputCost
    
    return {
      success: true,
      ...parsedResult,
      cost: totalCost
    }
    
  } catch (error) {
    console.error('DeepSeek翻译失败:', error)
    return {
      success: false,
      error: error.message
    }
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

async function markTaskCompleted(supabase: any, taskId: string) {
  await supabase
    .from('translation_queue')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
}
