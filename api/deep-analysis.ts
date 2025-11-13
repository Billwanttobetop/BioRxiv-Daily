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
  const maxChars = parseInt(process.env.ANALYSIS_MAX_CHARS || '12000', 10)
  const baseContent = text && text.length > 500 ? text : `${title || ''}\n\n${abstract || ''}`
  const content = (baseContent || '').slice(0, Math.max(1000, maxChars))

  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  if (!apiKey) {
    res.status(500).json({ success: false, error: { message: 'DeepSeek API key not configured' } })
    return
  }

  const prompt = `请用中文对下方论文文本进行深度分析，严格以JSON输出，不要输出任何解释性文字或多余符号。写作要求：专业但易读、语句简洁、信息密度高，避免空话与重复；不要照搬摘要原句；若信息不足明确说明“信息不足”，不要臆造。不要输出“公式：”或任何占位符。结构为“动机/洞见/方法(含创新)/实验/结果”，条目与长度受控：\n` +
    `【文本】\n${content}\n\n` +
    `【JSON结构】\n` +
    `{
      "motivation": "string",               // 动机：要解决的核心问题与痛点（120-180字）
      "insights": ["string"],               // 洞见：提出解决问题的核心思路或直觉（最多5条，每条35-60字；合并同义）
      "methods": {
        "overview": "string",              // 方法概述：如何实现上述洞见（120-160字）
        "innovations": ["string"]          // 创新：与既有方法的关键差异（最多3条）
      },
      "experiments": {
        "design": "string",                // 实验设计（中文段落，100-150字；描述对象、规模、比较维度）
        "datasets": ["string"],            // 数据集（数组，≤6项，给出名称或来源）
        "metrics": ["string"],             // 评估指标（数组，≤5项，如准确率、Kendall’s Tau等）
        "baselines": ["string"]            // 基线方法（数组，≤4项）
      },
      "results": {
        "main_findings": ["string"],       // 主要发现（中文要点数组，最多4条；优先可量化结论）
        "significance": "string",          // 结果意义（中文段落，100-140字；指向应用或理论）
        "limitations": ["string"]          // 局限（中文要点数组，最多3条；避免与方法描述重复）
      }
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
          { role: 'system', content: '你是资深学术分析助手。所有输出需为中文，且只输出严格JSON。' },
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
    let parsed
    try {
      parsed = JSON.parse(contentStr)
    } catch {
      // 尝试提取JSON片段
      const m = contentStr.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : null
    }
    if (!parsed) {
      res.status(200).json({ success: false, error: { message: '模型未返回有效JSON' } })
      return
    }
    // 规范化与去重，限制条目数
    const normText = (s: any) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : s)
    const normList = (arr: any[], max: number) => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const it of Array.isArray(arr) ? arr : []) {
        const t = normText(it)
        if (!t || seen.has(t)) continue
        seen.add(t)
        out.push(t)
        if (out.length >= max) break
      }
      return out
    }
    const normalized = {
      motivation: normText(parsed.motivation),
      insights: normList(parsed.insights, 5),
      methods: {
        overview: normText(parsed.methods?.overview),
        innovations: normList(parsed.methods?.innovations, 3),
      },
      experiments: {
        design: normText(parsed.experiments?.design),
        datasets: normList(parsed.experiments?.datasets, 6),
        metrics: normList(parsed.experiments?.metrics, 5),
        baselines: normList(parsed.experiments?.baselines, 4),
      },
      results: {
        main_findings: normList(parsed.results?.main_findings, 4),
        significance: normText(parsed.results?.significance),
        limitations: normList(parsed.results?.limitations, 3),
      },
    }
    res.status(200).json({ success: true, data: normalized })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}
