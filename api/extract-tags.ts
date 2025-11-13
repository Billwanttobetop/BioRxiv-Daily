import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { title, abstract } = req.body || {}
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  if (!apiKey) {
    res.status(200).json({ success: false, error: { message: 'DeepSeek API key not configured' } })
    return
  }

  const text = `${title || ''}\n\n${abstract || ''}`.slice(0, 4000)
  const prompt = `请基于以下论文标题与摘要，生成3-5个“泛化一级主题标签”的中文短语。\n` +
    `严格要求：\n` +
    `1) 标签要偏“学科/领域/对象/场景”的上位词，如“人工智能”“蛋白质”“免疫”“CRISPR”“塑料降解”“癌症”“神经科学”“微生物组”“材料”等；\n` +
    `2) 避免过细的技术词或具体分子名（如“K2P通道”“单分子蛋白质科学”），必要时向上归纳；\n` +
    `3) 每个标签不超过6个字；\n` +
    `4) 仅输出标签数组(JSON array)，不要任何解释；\n` +
    `5) 去除重复与同义近词。\n` +
    `【文本】\n${text}`

  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '只输出严格JSON数组，如["标签1","标签2"]。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    })
    if (!resp.ok) {
      const t = await resp.text()
      res.status(200).json({ success: false, error: { message: `DeepSeek error: ${t}` } })
      return
    }
    const json = await resp.json()
    const contentStr = json?.choices?.[0]?.message?.content || ''
    let tags: string[] | null = null
    try {
      const arr = JSON.parse(contentStr)
      if (Array.isArray(arr)) tags = arr.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    } catch {
      const m = contentStr.match(/\[[\s\S]*\]/)
      if (m) {
        const arr = JSON.parse(m[0])
        if (Array.isArray(arr)) tags = arr.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
      }
    }
    if (!tags || tags.length === 0) {
      res.status(200).json({ success: false, error: { message: '模型未返回标签' } })
      return
    }
    // 归一化到更泛化的主题词
    const normalize = (s: string) => {
      const t = s.trim()
      const low = t.toLowerCase()
      const cn = t
      const map: { key: string; match: (x: string) => boolean }[] = [
        { key: '人工智能', match: x => /人工智能|ai|深度学习|机器学习|神经网络/i.test(x) },
        { key: '蛋白质', match: x => /蛋白质|蛋白\b|protein/i.test(x) },
        { key: '免疫', match: x => /免疫|t细胞|b细胞|抗体|免疫治疗/i.test(x) },
        { key: 'CRISPR', match: x => /crispr|cas9|基因编辑|cas\b/i.test(x) },
        { key: '塑料降解', match: x => /塑料降解|聚合物降解|pet降解|微塑料/i.test(x) },
        { key: '癌症', match: x => /肿瘤|癌|癌症|癌基因|肿瘤微环境/i.test(x) },
        { key: '神经科学', match: x => /神经|大脑|脑|神经元|认知/i.test(x) },
        { key: '微生物组', match: x => /微生物组|肠道菌群|microbiome|菌群/i.test(x) },
        { key: '遗传学', match: x => /遗传|基因|基因组|基因变异|群体遗传/i.test(x) },
        { key: '材料', match: x => /材料|生物材料|纳米材料|高分子/i.test(x) },
        { key: '生物信息学', match: x => /生物信息|计算生物|bioinformatics/i.test(x) },
        { key: '合成生物学', match: x => /合成生物|synthetic biology/i.test(x) },
        { key: '代谢', match: x => /代谢|代谢通路|代谢组/i.test(x) },
        { key: '药物发现', match: x => /药物|药物发现|药物筛选|新药/i.test(x) }
      ]
      for (const m of map) {
        if (m.match(cn) || m.match(low)) return m.key
      }
      // 默认返回原词（短化）
      return cn.length > 6 ? cn.slice(0, 6) : cn
    }
    const seen = new Set<string>()
    const final: string[] = []
    for (const t of tags) {
      const norm = normalize(t)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      final.push(norm)
      if (final.length >= 5) break
    }
    res.status(200).json({ success: true, tags: final })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}
