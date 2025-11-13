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
  const prompt = `请基于以下论文标题与摘要，生成3-5个高度概括且适合作为标签的中文短语。要求：\n` +
    `1) 每个标签不超过8个字；2) 仅输出标签数组(JSON array)，不要任何解释；3) 标签需覆盖主题领域/方法/对象等关键信息；4) 去除重复与同义近词。\n` +
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
    // 去重并限制数量
    const seen = new Set<string>()
    const final = [] as string[]
    for (const t of tags) {
      if (!t || seen.has(t)) continue
      seen.add(t)
      final.push(t)
      if (final.length >= 5) break
    }
    res.status(200).json({ success: true, tags: final })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

