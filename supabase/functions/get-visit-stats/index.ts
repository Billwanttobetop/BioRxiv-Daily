import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)

    // PV
    const { count: pv } = await supabase
      .from('page_visits')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00.000Z`)

    // UV
    const { data: uvData, error: uvError } = await supabase.rpc('get_daily_unique_visitors', { for_date: today })
    if (uvError) throw uvError

    // Top Pages
    const { data: topPages, error: topPagesError } = await supabase.rpc('get_top_pages', { limit_count: 5 })
    if (topPagesError) throw topPagesError

    // Recent Visits
    const { data: recentVisits, error: recentVisitsError } = await supabase
      .from('page_visits')
      .select('created_at, path, ip_address')
      .order('created_at', { ascending: false })
      .limit(10)
    if (recentVisitsError) throw recentVisitsError

    return new Response(JSON.stringify({ pv, uv: uvData, topPages, recentVisits }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})