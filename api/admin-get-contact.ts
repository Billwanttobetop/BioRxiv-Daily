import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed')
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
    const { data } = await sb
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'contact_info')
      .maybeSingle()
    res.status(200).json({ success: true, contact: data?.setting_value || '' })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

