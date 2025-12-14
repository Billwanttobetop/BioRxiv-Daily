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
    const sql = `
      select t.name, count(*)::int as count
      from public.paper_tags pt
      join public.tags t on t.id = pt.tag_id
      group by t.name
      order by count desc
      limit 20;
    `
    const { data, error } = await sb.rpc('exec_sql', { query_text: sql } as any)
    if (error) {
      // 如果没有 exec_sql RPC，可采用客户端聚合作为兜底
      const { data: ptAll } = await sb.from('paper_tags').select('tag_id').limit(100000)
      const counts = new Map<string, number>()
      const ids = (ptAll || []).map(r => r.tag_id)
      const { data: tagsData } = await sb.from('tags').select('id,name').in('id', ids)
      const idToName = new Map<string, string>((tagsData || []).map(t => [t.id, t.name]))
      (ptAll || []).forEach(r => {
        const name = idToName.get(r.tag_id)
        if (!name) return
        counts.set(name, (counts.get(name) || 0) + 1)
      })
      const aggregated = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
      res.status(200).json({ success: true, tags: aggregated })
      return
    }
    // 直接返回 SQL 结果
    const list = (data as any[] | null) || []
    const tags = list.map(row => ({ name: row.name, count: Number(row.count || 0) }))
    res.status(200).json({ success: true, tags })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

