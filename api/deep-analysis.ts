import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

  const prompt = `请用中文对下方论文文本进行深度分析，严格以JSON输出，不要输出任何解释性文字或多余符号：\n` +
    `【文本】\n${content}\n\n` +
    `【JSON结构】\n` +
    `{
      "motivation": "string",               // 研究动机（中文段落，至少180字）
      "insights": ["string"],               // 核心洞见（中文要点数组，至少4-8条，每条40-80字）
      "methods": {
        "overview": "string",              // 方法总体思路（中文段落，至少150字）
        "key_techniques": ["string"],      // 关键技术（中文要点数组，至少3-6条）
        "innovations": ["string"]          // 方法创新点（中文要点数组，至少3-6条）
      },
      "experiments": {
        "design": "string",                // 实验设计（中文段落，至少150字）
        "datasets": ["string"],            // 数据集（数组，给出名称或来源）
        "metrics": ["string"],             // 评估指标（数组，如准确率、Kendall’s Tau等）
        "baselines": ["string"]            // 基线方法（数组）
      },
      "results": {
        "main_findings": ["string"],       // 主要发现（中文要点数组，至少3-6条）
        "significance": "string",          // 结果意义（中文段落，至少120字）
        "limitations": ["string"]          // 局限（中文要点数组，至少2-5条）
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
    // 保存到 Supabase，便于后续用户直接查看
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const sb = createClient(supabaseUrl, supabaseServiceKey)
        const row = {
          id: crypto.randomUUID(),
          paper_id: paperId,
          motivation: parsed.motivation,
          insights: parsed.insights,
          methods: parsed.methods,
          experiments: parsed.experiments,
          results: parsed.results,
          analysis_status: 'completed',
          analyzed_at: new Date().toISOString(),
        }
        await sb.from('paper_deep_analysis').upsert(row, { onConflict: 'paper_id' })
      } catch (e) {
        // 保存失败不影响前端展示
      }
    }
    res.status(200).json({ success: true, data: parsed })
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}
