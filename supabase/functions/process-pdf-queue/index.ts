import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// 队列处理配置
const BATCH_SIZE = 10 // 每批处理的PDF下载任务数量
const MAX_CONCURRENT_REQUESTS = 5 // 最大并发下载数

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('开始处理PDF下载队列...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 获取待处理的PDF下载任务
    const { data: pendingTasks, error: fetchError } = await supabase
      .from('pdf_download_queue')
      .select('id, paper_id, pdf_url, retry_count')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`获取PDF下载任务失败: ${fetchError.message}`)
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      console.log('没有待处理的PDF下载任务')
      return new Response(
        JSON.stringify({
          success: true,
          data: { processed: 0, message: '没有待处理的任务' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`获取到 ${pendingTasks.length} 个PDF下载任务`)

    // 更新任务状态为处理中
    const taskIds = pendingTasks.map(task => task.id)
    const { error: updateError } = await supabase
      .from('pdf_download_queue')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .in('id', taskIds)

    if (updateError) {
      throw new Error(`更新任务状态失败: ${updateError.message}`)
    }

    // 使用并发控制处理PDF下载任务
    const results = []
    for (let i = 0; i < pendingTasks.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = pendingTasks.slice(i, i + MAX_CONCURRENT_REQUESTS)
      console.log(`处理第 ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1} 批PDF下载任务，共 ${batch.length} 个`)
      
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          try {
            return await processPDFDownloadTask(task, supabase)
          } catch (error) {
            console.error(`处理PDF下载任务 ${task.id} 失败:`, error)
            return {
              taskId: task.id,
              success: false,
              error: error.message
            }
          }
        })
      )
      
      results.push(...batchResults)
      
      // 批次之间添加短暂延迟
      if (i + MAX_CONCURRENT_REQUESTS < pendingTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // 统计处理结果
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    console.log(`PDF下载队列处理完成: 成功 ${successful}, 失败 ${failed}`)

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
    console.error('处理PDF下载队列失败:', error)
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

async function processPDFDownloadTask(task: any, supabase: any) {
  const startTime = Date.now()
  
  try {
    console.log(`开始处理PDF下载任务: ${task.id}, 论文ID: ${task.paper_id}, URL: ${task.pdf_url}`)
    
    // 检查是否已存在全文
    const { data: existingFulltext } = await supabase
      .from('paper_fulltext')
      .select('id')
      .eq('paper_id', task.paper_id)
      .maybeSingle()
    
    if (existingFulltext) {
      console.log(`论文 ${task.paper_id} 全文已存在，跳过下载`)
      await supabase
        .from('pdf_download_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
      
      return {
        taskId: task.id,
        paperId: task.paper_id,
        success: true,
        skipped: true
      }
    }
    
    // 下载PDF
    const pdfResponse = await fetch(task.pdf_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.biorxiv.org/'
      }
    })
    
    if (!pdfResponse.ok) {
      throw new Error(`PDF下载失败: ${pdfResponse.status}`)
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer()
    console.log(`PDF下载完成，大小: ${pdfBuffer.byteLength} 字节`)
    
    // 调用 download-and-parse-pdf Edge Function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    const parseResponse = await fetch(`${supabaseUrl}/functions/v1/download-and-parse-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paper_id: task.paper_id,
        pdf_url: task.pdf_url
      })
    })
    
    if (!parseResponse.ok) {
      const errorText = await parseResponse.text()
      throw new Error(`PDF解析失败: ${parseResponse.status} - ${errorText}`)
    }
    
    const parseResult = await parseResponse.json()
    
    if (!parseResult.success) {
      throw new Error(`PDF解析返回错误: ${parseResult.error?.message || '未知错误'}`)
    }
    
    // 更新任务状态为完成
    const { error: completeError } = await supabase
      .from('pdf_download_queue')
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
    console.log(`PDF下载任务完成: ${task.id}, 耗时: ${processingTime}ms`)

    return {
      taskId: task.id,
      paperId: task.paper_id,
      success: true,
      wordCount: parseResult.data?.word_count,
      pageCount: parseResult.data?.page_count
    }

  } catch (error) {
    console.error(`PDF下载任务失败: ${task.id}`, error)
    
    // 判断是否需要重试
    if (task.retry_count < 3) {
      console.log(`任务 ${task.id} 将重试，当前重试次数: ${task.retry_count}`)
      
      await supabase
        .from('pdf_download_queue')
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
        .from('pdf_download_queue')
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
