import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { token, limit = 200, interval_ms = 500, only_new = true } = req.body || {}
  if (!token) {
    res.status(200).json({ success: false, error: { message: 'Unauthorized' } })
    return
  }
  // 简单令牌校验：需与 admin-login 的格式一致
  if (typeof token !== 'string' || token.length < 10) {
    res.status(200).json({ success: false, error: { message: 'Invalid token' } })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    res.status(200).json({ success: false, error: { message: 'Supabase not configured' } })
    return
  }
  const sb = createClient(supabaseUrl, serviceKey)

  try {
    const { data: papers } = await sb
      .from('papers')
      .select('id, title, abstract')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(1000, Number(limit) || 200)))

    const { data: analyzed } = await sb
      .from('paper_analysis')
      .select('paper_id')

    const analyzedSet = new Set((analyzed || []).map(r => r.paper_id))
    const toAnalyze = (papers || []).filter(p => (only_new ? !analyzedSet.has(p.id) : true))

    const results: { id: string; ok: boolean; error?: string }[] = []
    for (const p of toAnalyze) {
      try {
        // 调用 Supabase Edge Function
        const resp = await fetch(`${supabaseUrl}/functions/v1/analyze-paper-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ paper_id: p.id })
        })
        const ok = resp.ok
        results.push({ id: p.id, ok, error: ok ? undefined : (await resp.text()) })
        await new Promise(r => setTimeout(r, Math.max(100, Math.min(5000, Number(interval_ms) || 500))))
      } catch (e: any) {
        results.push({ id: p.id, ok: false, error: e?.message })
      }
    }
    res.status(200).json({ success: true, total: toAnalyze.length, results })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

