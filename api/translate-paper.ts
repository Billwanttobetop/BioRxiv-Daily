import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } })
  }

  const { paper_id } = req.body || {}
  
  if (!paper_id) {
    return res.status(400).json({ success: false, error: { message: 'Missing paper_id' } })
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        success: false, 
        error: { message: 'Supabase configuration missing' } 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取论文信息
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('id, title, abstract')
      .eq('id', paper_id)
      .single()

    if (paperError || !paper) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Paper not found' } 
      })
    }

    // 调用 Supabase Edge Function 进行翻译
    const { data: translationData, error: translationError } = await supabase.functions.invoke(
      'translate-paper',
      {
        body: { 
          paper_id: paper.id,
          title: paper.title,
          abstract: paper.abstract
        }
      }
    )

    if (translationError) {
      console.error('Translation error:', translationError)
      return res.status(500).json({ 
        success: false, 
        error: { message: 'Translation failed', details: translationError.message } 
      })
    }

    // 提取标签
    let tags: string[] = []
    try {
      const extractResp = await fetch(`${req.headers.origin || ''}/api/extract-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: paper.title, 
          abstract: paper.abstract 
        })
      })
      
      if (extractResp.ok) {
        const extractJson = await extractResp.json()
        if (extractJson.success && Array.isArray(extractJson.tags)) {
          tags = extractJson.tags
        }
      }
    } catch (e) {
      console.error('Tag extraction error:', e)
    }

    return res.status(200).json({
      success: true,
      data: {
        ...translationData?.data,
        tags
      }
    })

  } catch (error: any) {
    console.error('Translate paper API error:', error)
    return res.status(500).json({ 
      success: false, 
      error: { message: error.message || 'Internal server error' } 
    })
  }
}
