import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface RequestBody { paper_id: string }

function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = withoutScripts.replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

async function tryFetchJatsText(doi: string): Promise<string | null> {
  try {
    const server = doi?.startsWith('10.1101/') ? 'biorxiv' : 'medrxiv'
    const metaResp = await fetch(`https://api.biorxiv.org/details/${server}/${encodeURIComponent(doi)}/na/json`)
    if (!metaResp.ok) return null
    const meta = await metaResp.json()
    const item = (meta?.collection && meta.collection[0]) ? meta.collection[0] : null
    if (!item) return null
    const jatsPathKey = Object.keys(item).find(k => k.toLowerCase().includes('jats'))
    const jatsPath = jatsPathKey ? item[jatsPathKey] : null
    if (!jatsPath || typeof jatsPath !== 'string') return null
    const jatsUrl = jatsPath.startsWith('http') ? jatsPath : `https://www.${server}.org${jatsPath}`
    const jatsResp = await fetch(jatsUrl, { headers: { 'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8' } })
    if (jatsResp.ok) {
      const xml = await jatsResp.text()
      return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    // 尝试阅读器代理
    const readerResp = await fetch(`https://r.jina.ai/${jatsUrl}`, { headers: { 'Accept': 'text/plain' } })
    if (readerResp.ok) {
      const txt = await readerResp.text()
      return txt?.trim() || null
    }
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const { paper_id }: RequestBody = await req.json()
    if (!paper_id) return new Response(JSON.stringify({ success: false, error: { message: '缺少paper_id' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('缺少Supabase配置')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: paper, error } = await supabase
      .from('papers')
      .select('id,title,abstract,source_url,pdf_url,doi')
      .eq('id', paper_id)
      .single()
    if (error || !paper) throw new Error(`获取论文失败: ${error?.message || '不存在'}`)

    const url = paper.source_url || paper.pdf_url
    if (!url && !paper.doi) throw new Error('缺少原文链接或DOI')

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    })
    let text = ''
    if (url) {
      if (!resp.ok) throw new Error(`抓取原文失败: ${resp.status}`)
      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        const html = await resp.text()
        text = htmlToText(html)
      } else {
        const readerUrl = `https://r.jina.ai/${url}`
        const r = await fetch(readerUrl, { headers: { 'Accept': 'text/plain' } })
        if (r.ok) {
          text = await r.text()
        }
      }
    }
    // 若仍不足，尝试通过BioRxiv API获取JATS全文
    if ((!text || text.length < 1000) && paper.doi) {
      const jatsText = await tryFetchJatsText(paper.doi)
      if (jatsText && jatsText.length > 1000) {
        text = jatsText
      }
    }
    if (!text || text.length < 1000) throw new Error('原文文本提取失败或长度不足')

    await supabase.from('paper_fulltext').upsert({ paper_id, full_text: text }, { onConflict: 'paper_id' })

    return new Response(JSON.stringify({ success: true, data: { length: text.length } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: { message: e?.message || 'UNKNOWN' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
