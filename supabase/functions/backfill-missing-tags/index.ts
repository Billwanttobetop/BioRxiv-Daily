import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface BackfillRequest { limit?: number }

interface DeepSeekResponse { choices: Array<{ message: { content: string } }>; }

function buildTagPrompt(title: string, abstract: string): string {
  return `请基于以下论文标题与摘要，提取3-6个中文“一级主题标签”（学科上位词，避免过细名词）。以JSON返回：{ "tags": ["...","..."] }。\n\n标题：${title}\n\n摘要：${abstract}`
}

async function extractTags(apiKey: string, apiUrl: string, title: string, abstract: string): Promise<string[]> {
  const resp = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位学术分类专家，请仅返回JSON对象' },
        { role: 'user', content: buildTagPrompt(title, abstract) }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })
  })
  if (!resp.ok) throw new Error(`DeepSeek错误: ${resp.status} ${await resp.text()}`)
  const json: DeepSeekResponse = await resp.json()
  const content = json.choices[0].message.content
  try {
    const parsed = JSON.parse(content)
    const tags = Array.isArray(parsed.tags) ? parsed.tags : []
    return tags.map((t: string) => (t || '').trim()).filter(Boolean)
  } catch {
    const m = content.match(/\[([^\]]+)\]/)
    if (m) { try { return JSON.parse(`[${m[1]}]`).map((t: string) => t.trim()).filter(Boolean) } catch {} }
    return []
  }
}

async function saveTagsForPaper(supabase: any, paperId: string, tagNames: string[]) {
  const names = Array.from(new Set((tagNames || []).map(n => (n || '').trim()).filter(Boolean)))
  for (const name of names) {
    const { data: existing } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
    let tagId = existing?.id
    if (!tagId) {
      const { data: created } = await supabase.from('tags').upsert({ name }, { onConflict: 'name' }).select('id').single()
      tagId = created?.id
    }
    if (!tagId) continue
    const { data: rel } = await supabase.from('paper_tags').select('id').eq('paper_id', paperId).eq('tag_id', tagId).maybeSingle()
    if (!rel) await supabase.from('paper_tags').insert({ paper_id: paperId, tag_id: tagId })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const { limit = 200 }: BackfillRequest = await req.json().catch(() => ({ limit: 200 }))
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    const deepseekApiUrl = Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1'
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('缺少Supabase配置')
    if (!deepseekApiKey) throw new Error('DeepSeek API密钥未配置')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: rows } = await supabase
      .from('papers')
      .select('id,title,abstract')
      .limit(Math.max(1, Math.min(1000, limit)))
      .order('published_date', { ascending: false })
    const results: any[] = []

    for (const p of rows || []) {
      const { count } = await supabase.from('paper_tags').select('*', { count: 'exact', head: true }).eq('paper_id', p.id)
      if ((count || 0) > 0) continue
      try {
        const tags = await extractTags(deepseekApiKey, deepseekApiUrl, p.title, p.abstract || '')
        if (tags.length > 0) await saveTagsForPaper(supabase, p.id, tags)
        results.push({ id: p.id, ok: true, tags })
      } catch (e: any) {
        results.push({ id: p.id, ok: false, error: e?.message || 'error' })
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { message: (error as any)?.message || 'UNKNOWN' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

