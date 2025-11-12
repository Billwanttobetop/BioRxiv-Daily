import type { VercelRequest, VercelResponse } from '@vercel/node'

function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = withoutScripts.replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

async function fetchTextFromSources(sourceUrl?: string | null, pdfUrl?: string | null): Promise<string> {
  // Prefer BioRxiv HTML+PDF page
  const candidates: string[] = []
  if (sourceUrl) {
    candidates.push(`${sourceUrl}.full.pdf+html`)
    candidates.push(`${sourceUrl}.full`)
  }
  // As a last resort try raw PDF URL (will not parse PDF, but may contain some text if served as HTML)
  if (pdfUrl) candidates.push(pdfUrl)

  for (const url of candidates) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const ct = resp.headers.get('content-type') || ''
      if (ct.includes('text/html')) {
        const html = await resp.text()
        const text = htmlToText(html)
        if (text && text.length > 500) return text
      } else if (ct.includes('application/pdf')) {
        // Unable to parse PDF server-side without extra deps; skip
        continue
      } else {
        const body = await resp.text()
        const text = htmlToText(body)
        if (text && text.length > 500) return text
      }
    } catch (e) {
      // try next candidate
    }
  }
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { paperId, title, abstract, source_url, pdf_url } = req.body || {}
  if (!paperId) {
    res.status(400).json({ success: false, error: { message: 'missing paperId' } })
    return
  }

  // Fetch text content
  const text = await fetchTextFromSources(source_url, pdf_url)
  const content = text && text.length > 500 ? text : `${title || ''}\n\n${abstract || ''}`

  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  if (!apiKey) {
    res.status(500).json({ success: false, error: { message: 'DeepSeek API key not configured' } })
    return
  }

  const prompt = `请基于以下论文全文或摘要进行深度学术分析，并用JSON严格输出：\n` +
    `【文本】\n${content}\n\n` +
    `【输出要求】\n` +
    `{
      "motivation": "string",
      "insights": ["string", "string"],
      "methods": {"overview":"string","key_techniques":["string"],"innovations":["string"]},
      "experiments": {"design":"string","datasets":["string"],"metrics":["string"],"baselines":["string"]},
      "results": {"main_findings":["string"],"performance_gains":["string"],"significance":"string","limitations":["string"]},
      "technical_novelty_score": 0-10,
      "practical_impact_score": 0-10,
      "theoretical_contribution_score": 0-10,
      "confidence_score": 0-10,
      "analyzed_at": "YYYY-MM-DD HH:mm:ss"
    }`

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
          { role: 'system', content: '你是资深学术分析助手。只输出严格JSON。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    })
    if (!resp.ok) {
      const t = await resp.text()
      res.status(500).json({ success: false, error: { message: `DeepSeek error: ${t}` } })
      return
    }
    const json = await resp.json()
    const contentStr = json?.choices?.[0]?.message?.content || ''
    let parsed
    try {
      parsed = JSON.parse(contentStr)
    } catch {
      // 尝试提取JSON片段
      const m = contentStr.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : null
    }
    if (!parsed) {
      res.status(500).json({ success: false, error: { message: '模型未返回有效JSON' } })
      return
    }
    res.status(200).json({ success: true, data: parsed })
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}

