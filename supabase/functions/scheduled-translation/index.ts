import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('开始执行定时翻译任务...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }

    // 调用翻译队列处理函数
    const response = await fetch(`${supabaseUrl}/functions/v1/process-translation-queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`处理翻译队列失败: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('定时翻译任务执行完成:', result)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: '定时翻译任务执行完成',
          result: result.data
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('定时翻译任务执行失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SCHEDULED_TASK_ERROR',
          message: error.message
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})