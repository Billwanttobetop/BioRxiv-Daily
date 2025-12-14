import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Cron } from 'https://esm.sh/croner@7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// 队列处理配置
const BATCH_SIZE = 5 // 每批处理的翻译任务数量
const RETRY_DELAY = 5000 // 重试延迟（毫秒）
const MAX_PROCESSING_TIME = 300000 // 最大处理时间（5分钟）

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('开始处理翻译队列...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
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

    // 并行处理翻译任务
    const results = await Promise.allSettled(
      pendingTasks.map(async (task) => {
        try {
          return await processTranslationTask(task, supabase)
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

async function processTranslationTask(task: any, supabase: any) {
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

    console.log(`获取论文信息成功: ${paper.title}`)

    // 调用翻译函数
    const translationResult = await performTranslation(paper)
    
    if (!translationResult.success) {
      throw new Error(`翻译失败: ${translationResult.error}`)
    }

    // 更新论文分析表
    const { error: updateError } = await supabase
      .from('paper_analysis')
      .upsert({
        paper_id: task.paper_id,
        title_cn: translationResult.data.title_cn,
        abstract_cn: translationResult.data.abstract_cn,
        main_institutions: translationResult.data.main_institutions,
        translation_model: 'deepseek-chat',
        translation_cost: translationResult.data.translation_cost,
        translation_status: 'completed',
        translated_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })

    if (updateError) {
      throw new Error(`更新翻译结果失败: ${updateError.message}`)
    }

    // 更新任务状态为完成
    const { error: completeError } = await supabase
      .from('translation_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id)

    if (completeError) {
      throw new Error(`更新任务状态失败: ${completeError.message}`)
    }

    const processingTime = Date.now() - startTime
    console.log(`翻译任务完成: ${task.id}, 耗时: ${processingTime}ms`)

    return {
      taskId: task.id,
      paperId: task.paper_id,
      success: true,
      processingTime,
      cost: translationResult.data.translation_cost
    }

  } catch (error) {
    console.error(`翻译任务失败: ${task.id}`, error)
    
    // 判断是否需要重试
    if (task.retry_count < 3) {
      console.log(`任务 ${task.id} 将重试，当前重试次数: ${task.retry_count}`)
      
      // 更新重试状态
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

async function performTranslation(paper: any) {
  try {
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    const deepseekApiUrl = Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1'
    
    if (!deepseekApiKey) {
      return {
        success: false,
        error: 'DeepSeek API密钥未配置'
      }
    }

    // 构建翻译提示词
    const translationPrompt = `你是一位专业的学术翻译专家，专门翻译生物医学领域的学术论文。

请将以下英文论文标题和摘要翻译成中文，要求：
1. 准确传达原文的学术含义
2. 使用规范的中文学术语言
3. 保持专业术语的准确性
4. 摘要翻译要完整、流畅

英文标题：${paper.title}

英文摘要：${paper.abstract}

请提供以下JSON格式的翻译结果：
{
  "title_cn": "中文标题",
  "abstract_cn": "中文摘要",
  "main_institutions": ["主要研究机构1", "主要研究机构2"]
}

注意：
- 如果无法确定研究机构，可以留空数组
- 确保翻译质量，不要遗漏重要信息
- 保持学术严谨性`

    console.log('调用DeepSeek API进行翻译...')
    
    const response = await fetch(`${deepseekApiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的学术翻译专家，擅长将英文学术论文准确翻译成中文。请严格按照JSON格式返回翻译结果。'
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
    
    const result = await response.json()
    const translatedContent = result.choices[0].message.content
    
    console.log('DeepSeek API响应:', translatedContent)
    
    // 解析翻译结果
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
        main_institutions: []
      }
    }
    
    // 估算token数量和成本
    const inputTokens = estimateTokens(paper.title + ' ' + paper.abstract)
    const outputTokens = estimateTokens(parsedResult.title_cn + ' ' + parsedResult.abstract_cn)
    const totalTokens = inputTokens + outputTokens
    
    // DeepSeek定价：$0.14 per 1M input tokens, $0.28 per 1M output tokens
    const inputCost = (inputTokens / 1000000) * 0.14
    const outputCost = (outputTokens / 1000000) * 0.28
    const totalCost = inputCost + outputCost
    
    console.log(`翻译token统计: 输入${inputTokens}, 输出${outputTokens}, 总成本$${totalCost.toFixed(6)}`)
    
    return {
      success: true,
      data: {
        title_cn: parsedResult.title_cn,
        abstract_cn: parsedResult.abstract_cn,
        main_institutions: parsedResult.main_institutions,
        translation_cost: totalCost,
        token_count: totalTokens
      }
    }
    
  } catch (error) {
    console.error('翻译失败:', error)
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