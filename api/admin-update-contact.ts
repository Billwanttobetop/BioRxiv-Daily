import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { token, contact } = req.body || {}
  if (!token) {
    res.status(200).json({ success: false, error: { message: 'Unauthorized' } })
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
    await sb.from('site_settings').upsert({ setting_key: 'contact_info', setting_value: String(contact || '') })
    res.status(200).json({ success: true })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

