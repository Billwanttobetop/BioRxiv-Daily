import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
  const limit = Math.max(50, Math.min(2000, Number(req.body?.limit) || 500))
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  if (!supabaseUrl || !serviceKey || !apiKey) { res.status(200).json({ success: false, error: { message: 'Server not configured' } }); return }
  const sb = createClient(supabaseUrl, serviceKey)
  try {
    const { data: papers } = await sb.from('papers').select('id,title,abstract').order('created_at', { ascending: false }).limit(limit)
    const ids = (papers || []).map(p => p.id)
    const { data: rel } = await sb.from('paper_tags').select('paper_id').in('paper_id', ids)
    const hasTags = new Set((rel || []).map(r => r.paper_id))
    const targets = (papers || []).filter(p => !hasTags.has(p.id))

    const normalize = (s: string) => {
      const x = s.trim().toLowerCase()
      const maps: { key: string; test: RegExp }[] = [
        { key: '人工智能', test: /(人工智能|ai|深度学习|机器学习|神经网络)/i },
        { key: '蛋白质', test: /(蛋白质|protein)/i },
        { key: '免疫', test: /(免疫|t细胞|b细胞|抗体|免疫治疗)/i },
        { key: 'CRISPR', test: /(crispr|cas9|基因编辑|cas\b)/i },
        { key: '癌症', test: /(肿瘤|癌症|癌)/i },
        { key: '神经科学', test: /(神经|大脑|脑|神经元|认知)/i },
        { key: '微生物组', test: /(微生物组|肠道菌群|microbiome|菌群)/i },
        { key: '遗传学', test: /(遗传|基因|基因组|变异)/i },
        { key: '材料', test: /(材料|生物材料|纳米材料|高分子)/i },
        { key: '生物信息学', test: /(生物信息|计算生物|bioinformatics)/i },
        { key: '合成生物学', test: /(合成生物|synthetic biology)/i },
        { key: '代谢', test: /(代谢|代谢通路|代谢组)/i },
        { key: '药物发现', test: /(药物|药物发现|药物筛选|新药)/i }
      ]
      for (const m of maps) if (m.test.test(x)) return m.key
      return s.length > 6 ? s.slice(0, 6) : s
    }

    const results: { id: string; ok: boolean; tags?: string[]; error?: string }[] = []
    for (const p of targets) {
      try {
        const prompt = `请基于论文标题与摘要生成3-5个“一级主题”标签，JSON输出：{"tags": [".."]}。标签需泛化、中文、<=6字；去重。\n标题: ${p.title}\n摘要: ${p.abstract || ''}`
        const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [ { role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: prompt } ], temperature: 0.2, response_format: { type: 'json_object' } })
        })
        if (!resp.ok) { results.push({ id: p.id, ok: false, error: 'LLM error' }); continue }
        const out = await resp.json()
        let content = out?.choices?.[0]?.message?.content || '{}'
        let parsed: any = {}
        try { parsed = JSON.parse(content) } catch { const m = content.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} }
        const tags = Array.from(new Set(((parsed.tags || []) as string[]).map(s => normalize(s)).filter(Boolean))).slice(0, 5)
        if (tags.length === 0) { results.push({ id: p.id, ok: false, error: 'no tags' }); continue }
        const tagIds: string[] = []
        for (const name of tags) {
          const { data: t } = await sb.from('tags').select('id').eq('name', name).maybeSingle()
          let tagId = t?.id
          if (!tagId) {
            const { data: created } = await sb.from('tags').upsert({ name }, { onConflict: 'name' }).select('id').single()
            tagId = created?.id
          }
          if (tagId) tagIds.push(tagId)
        }
        for (const tid of tagIds) {
          const { data: relRow } = await sb.from('paper_tags').select('id').eq('paper_id', p.id).eq('tag_id', tid).maybeSingle()
          if (!relRow) await sb.from('paper_tags').insert({ paper_id: p.id, tag_id: tid })
        }
        results.push({ id: p.id, ok: true, tags })
      } catch (e: any) {
        results.push({ id: p.id, ok: false, error: e?.message || 'error' })
      }
    }
    res.status(200).json({ success: true, processed: results.length, results })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

