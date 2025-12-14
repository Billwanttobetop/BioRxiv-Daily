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
    const { data, error } = await sb.rpc('get_popular_tags', { limit_count: 20 })
    if (!error && data && Array.isArray(data) && data.length > 0) {
      const tags = data.map((row: any) => ({ name: row.name, count: Number(row.count || 0) }))
      res.status(200).json({ success: true, tags })
      return
    }
    const pageSize = 1000
    let offset = 0
    const counts = new Map<string, number>()
    while (true) {
      const { data: ptChunk } = await sb
        .from('paper_tags')
        .select('tag_id')
        .range(offset, offset + pageSize - 1)
      const list = (ptChunk as { tag_id: string }[] | null) || []
      if (list.length === 0) break
      const chunkIds = Array.from(new Set(list.map(r => r.tag_id)))
      const { data: tagsData } = await sb.from('tags').select('id,name').in('id', chunkIds)
      const idToName = new Map<string, string>((tagsData || []).map(t => [t.id, t.name]))
      list.forEach(r => {
        const name = idToName.get(r.tag_id)
        if (!name) return
        counts.set(name, (counts.get(name) || 0) + 1)
      })
      if (list.length < pageSize) break
      offset += pageSize
    }
    const aggregated = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    res.status(200).json({ success: true, tags: aggregated })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

