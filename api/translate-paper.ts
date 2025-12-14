import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 使用 Serverless Runtime（默认），但直接调用 Supabase Edge Function 以避免超时
// Use Serverless Runtime (default) but delegate to Supabase Edge Function to avoid timeout
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { paper_id } = req.body || {}
  if (!paper_id) {
    res.status(200).json({ success: false, error: { message: 'paper_id required' } })
    return
  }
  
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl) {
    res.status(500).json({ success: false, error: { message: 'Server Config Error: SUPABASE_URL missing' } })
    return
  }
  if (!serviceKey) {
    res.status(500).json({ success: false, error: { message: 'Server Config Error: SUPABASE_SERVICE_ROLE_KEY missing' } })
    return
  }

  try {
    const sb = createClient(supabaseUrl, serviceKey)
    
    // 复用管理员后台验证过的路径：调用 Supabase Edge Function
    // Reuse the proven path from Admin Console: invoke Supabase Edge Function
    const { data, error } = await sb.functions.invoke('analyze-paper-v2', {
      body: { paper_id }
    })

    if (error) {
      console.error('Supabase Function Error:', error)
      // 如果 Supabase Function 调用失败，返回具体错误
      // If Supabase Function fails, return specific error
      res.status(200).json({ success: false, error: { message: error.message || 'Analysis Service Error' } })
      return
    }

    // analyze-paper-v2 返回结构通常是 { success: true, data: ... } 或直接返回数据
    // 我们假设它返回 { success: true, data: { title_cn, abstract_cn, tags } }
    // 如果它只做了分析没返回 tags，我们可能需要额外处理，但管理员后台看起来是一步到位的
    
    // 管理员后台逻辑是：先 invoke 'analyze-paper-v2'，然后 fetch '/api/extract-tags' (如果需要)
    // 但 analyze-paper-v2 应该已经包含了翻译。我们先看看它返回什么。
    // 假设 analyze-paper-v2 负责写库，但不一定返回最新数据。
    // 所以我们invoke成功后，再查一次库返回给前端。
    
    const { data: analysis } = await sb
      .from('paper_analysis')
      .select('title_cn, abstract_cn')
      .eq('paper_id', paper_id)
      .maybeSingle()
      
    const { data: tagsRel } = await sb
      .from('paper_tags')
      .select('tags(name)')
      .eq('paper_id', paper_id)
    
    const tags = tagsRel?.map((r: any) => r.tags?.name).filter(Boolean) || []

    res.status(200).json({ 
      success: true, 
      data: { 
        title_cn: analysis?.title_cn || '', 
        abstract_cn: analysis?.abstract_cn || '', 
        tags 
      } 
    })

  } catch (e: any) {
    console.error('API Handler Error:', e)
    res.status(500).json({ success: false, error: { message: e?.message || 'Server Internal Error' } })
  }
}
