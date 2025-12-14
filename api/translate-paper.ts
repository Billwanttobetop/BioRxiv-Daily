import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
  const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  
  if (!supabaseUrl) {
    res.status(200).json({ success: false, error: { message: 'Server Config Error: SUPABASE_URL missing' } })
    return
  }
  // 翻译和标签生成是写入操作，必须使用 Service Key 以绕过 RLS（除非我们为 anon 开放了写入权限，但这不安全）
  // Translation is a write operation, so we MUST use Service Key to bypass RLS.
  // If Service Key is missing, we cannot proceed with writing to the database.
  if (!serviceKey) {
    res.status(200).json({ 
      success: false, 
      error: { 
        message: 'Server Config Error: SUPABASE_SERVICE_ROLE_KEY missing. Translation requires admin privileges to write to the database. Please configure this environment variable in Vercel.' 
      } 
    })
    return
  }
  if (!DEEPSEEK_API_KEY) {
    res.status(200).json({ success: false, error: { message: 'Server Config Error: DEEPSEEK_API_KEY missing' } })
    return
  }
  const sb = createClient(supabaseUrl, serviceKey)
  try {
    const { data: paper, error: pErr } = await sb
      .from('papers')
      .select('id,title,abstract')
      .eq('id', paper_id)
      .maybeSingle()
    if (pErr) throw pErr
    if (!paper) {
      res.status(200).json({ success: false, error: { message: 'Paper not found' } })
      return
    }
    const text = `标题: ${paper.title}\n\n摘要: ${paper.abstract || ''}`
    const prompt = `你是中文学术助手。请将给定的英文论文标题与摘要翻译成中文，并总结3-5个“一级主题”标签。\n严格要求：\n1) 输出JSON：{ "title_cn": "..", "abstract_cn": "..", "tags": [".."] }\n2) 标签偏上位词，如“人工智能”“蛋白质”“免疫”“CRISPR”“癌症”“神经科学”“微生物组”“遗传学”“材料”“生物信息学”“合成生物学”“代谢”“药物发现”等，避免过细术语；字符数<=6；\n3) 去重与同义合并；\n文本如下：\n${text}`
    const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })
    if (!resp.ok) {
      const txt = await resp.text()
      res.status(200).json({ success: false, error: { message: `LLM请求失败: ${txt.slice(0,120)}` } })
      return
    }
    const out = await resp.json()
    let content = out?.choices?.[0]?.message?.content || ''
    // 尝试稳健提取JSON
    let parsed: { title_cn?: string; abstract_cn?: string; tags?: string[] } = {}
    try { parsed = JSON.parse(content) } catch {
      try {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch {}
    }
    const title_cn = (parsed.title_cn || '').trim()
    const abstract_cn = (parsed.abstract_cn || '').trim()
    const tagsRaw = Array.from(new Set((parsed.tags || []).map(s => (s || '').trim()).filter(Boolean)))
    // 归一化更泛化的主题词
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
    const tags = Array.from(new Set(tagsRaw.map(normalize))).slice(0, 5)
    if (!title_cn && !abstract_cn) {
      res.status(200).json({ success: false, error: { message: 'LLM output invalid' } })
      return
    }
    // 写入 paper_analysis（若存在则更新）
    const { data: existing } = await sb
      .from('paper_analysis')
      .select('id')
      .eq('paper_id', paper_id)
      .maybeSingle()
    if (existing?.id) {
      await sb.from('paper_analysis').update({ title_cn, abstract_cn, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await sb.from('paper_analysis').insert({ paper_id, title_cn, abstract_cn, created_at: new Date().toISOString() })
    }
    // 标签写库
    const tagIds: string[] = []
    for (const name of tags) {
      const { data: t } = await sb.from('tags').select('id').eq('name', name).maybeSingle()
      let tagId = t?.id
      if (!tagId) {
        const { data: created } = await sb
          .from('tags')
          .upsert({ name }, { onConflict: 'name' })
          .select('id')
          .single()
        tagId = created?.id
      }
      if (tagId) tagIds.push(tagId)
    }
    for (const tid of tagIds) {
      const { data: rel } = await sb
        .from('paper_tags')
        .select('id')
        .eq('paper_id', paper_id)
        .eq('tag_id', tid)
        .maybeSingle()
      if (!rel) await sb.from('paper_tags').insert({ paper_id, tag_id: tid })
    }
    res.status(200).json({ success: true, data: { title_cn, abstract_cn, tags } })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

