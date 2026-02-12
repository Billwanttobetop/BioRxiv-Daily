import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface TranslationRequest {
  paper_id: string
  title: string
  abstract: string
  priority?: number
  force?: boolean
}

interface TranslationResult {
  title_cn: string
  abstract_cn: string
  main_institutions: string[]
  tags: string[]
  translation_cost: number
  token_count: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { paper_id, title, abstract, priority = 1, force = false }: TranslationRequest = await req.json()
    if (!paper_id || !title || !abstract) {
      return new Response(JSON.stringify({ success: false, error: { message: '缺少必需参数' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    const deepseekApiUrl = Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1'
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('缺少Supabase配置')
    if (!deepseekApiKey) {
      return new Response(JSON.stringify({ success: true, data: { skipped: true, reason: 'API密钥未配置' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existingAnalysis } = await supabase.from('paper_analysis').select('id,title_cn,abstract_cn,translation_status').eq('paper_id', paper_id).maybeSingle()
    if (!force && existingAnalysis && existingAnalysis.translation_status === 'completed') {
      return new Response(JSON.stringify({ success: true, data: { cached: true, title_cn: existingAnalysis.title_cn, abstract_cn: existingAnalysis.abstract_cn } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('paper_analysis').upsert({ paper_id, translation_status: 'processing', analyzed_at: new Date().toISOString() }, { onConflict: 'paper_id' })

    const startTime = Date.now()
    const tr = await performTranslation(title, abstract, deepseekApiKey, deepseekApiUrl)
    const processingTime = Date.now() - startTime

    if (tr.tags && tr.tags.length > 0) await saveTagsForPaper(supabase, paper_id, tr.tags)

    const { error: updateError } = await supabase.from('paper_analysis').upsert({ paper_id, title_cn: tr.title_cn, abstract_cn: tr.abstract_cn, main_institutions: tr.main_institutions, translation_model: 'deepseek-chat', translation_cost: tr.translation_cost, translation_status: 'completed', analyzed_at: new Date().toISOString() }, { onConflict: 'paper_id' })
    if (updateError) throw new Error(`更新翻译结果失败: ${updateError.message}`)

    await supabase.from('analysis_statistics').insert({ analysis_type: 'translation', paper_id, model_used: 'deepseek-chat', token_consumed: tr.token_count, cost_usd: tr.translation_cost, processing_time: Math.ceil(processingTime / 1000), status: 'success' })

    return new Response(JSON.stringify({ success: true, data: { title_cn: tr.title_cn, abstract_cn: tr.abstract_cn, main_institutions: tr.main_institutions, translation_cost: tr.translation_cost, token_count: tr.token_count, processing_time } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await supabase.from('analysis_statistics').insert({ analysis_type: 'translation', status: 'failed', error_type: error.message?.substring(0, 50) || 'unknown_error' })
      const { paper_id } = await req.json().catch(() => ({ paper_id: null }))
      if (paper_id) await supabase.from('paper_analysis').upsert({ paper_id, translation_status: 'failed', analyzed_at: new Date().toISOString() }, { onConflict: 'paper_id' })
    } catch {}
    return new Response(JSON.stringify({ success: false, error: { code: 'TRANSLATION_ERROR', message: error.message } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

async function performTranslation(title: string, abstract: string, apiKey: string, apiUrl: string): Promise<TranslationResult> {
  const translationPrompt = `你是一位专业的学术翻译专家，专门翻译生物医学领域的学术论文。\n\n请将以下英文论文标题和摘要翻译成中文，并提取3-5个“泛化一级主题标签”（中文、学科/领域上位词）。\n\n英文标题：${title}\n\n英文摘要：${abstract}\n\n返回JSON：{ "title_cn": "...", "abstract_cn": "...", "main_institutions": [], "tags": ["...","..."] }`

  const response = await fetch(`${apiUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '请严格按照JSON对象返回结果' }, { role: 'user', content: translationPrompt }], temperature: 0.3, max_tokens: 2000, response_format: { type: 'json_object' } }) })
  if (!response.ok) throw new Error(`DeepSeek API调用失败: ${response.status} ${await response.text()}`)
  const result: DeepSeekResponse = await response.json()
  const content = result.choices[0].message.content

  let parsed: TranslationResult
  try {
    parsed = JSON.parse(content)
    if (!parsed.title_cn || !parsed.abstract_cn) throw new Error('翻译结果不完整')
    if (!Array.isArray(parsed.main_institutions)) parsed.main_institutions = []
    if (!Array.isArray(parsed.tags)) parsed.tags = []
  } catch {
    const t = content.match(/"title_cn"\s*:\s*"([^"]+)"/)
    const a = content.match(/"abstract_cn"\s*:\s*"([^"]+)"/)
    if (!t || !a) throw new Error('无法解析翻译JSON')
    parsed = { title_cn: t[1], abstract_cn: a[1], main_institutions: [], tags: [], translation_cost: 0, token_count: 0 }
  }

  const inputTokens = estimateTokens(title + ' ' + abstract)
  const outputTokens = estimateTokens(parsed.title_cn + ' ' + parsed.abstract_cn)
  const totalTokens = inputTokens + outputTokens
  const inputCost = (inputTokens / 1000000) * 0.14
  const outputCost = (outputTokens / 1000000) * 0.28
  const totalCost = inputCost + outputCost

  return { ...parsed, translation_cost: totalCost, token_count: totalTokens }
}

function estimateTokens(text: string): number {
  let chineseCount = 0
  let englishCount = 0
  for (const c of text) {
    if (/[\u4e00-\u9fff]/.test(c)) chineseCount++
    else if (/[a-zA-Z]/.test(c)) englishCount++
  }
  return Math.ceil(chineseCount * 0.6 + englishCount * 0.3)
}

async function saveTagsForPaper(supabase: any, paperId: string, tagNames: string[]) {
  const names = Array.from(new Set((tagNames || []).map(n => (n || '').trim()).filter(Boolean)))
  for (const name of names) {
    try {
      const { data: existing } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
      let tagId = existing?.id
      if (!tagId) {
        const { data: inserted } = await supabase.from('tags').upsert({ name }, { onConflict: 'name' }).select('id').single()
        tagId = inserted?.id
      }
      if (!tagId) continue
      const { data: rel } = await supabase.from('paper_tags').select('id').eq('paper_id', paperId).eq('tag_id', tagId).maybeSingle()
      if (!rel) await supabase.from('paper_tags').insert({ paper_id: paperId, tag_id: tagId })
    } catch {}
  }
}
