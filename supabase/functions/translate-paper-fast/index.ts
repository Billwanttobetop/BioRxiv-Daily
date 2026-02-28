import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface TranslationRequest {
  paper_id: string
  title: string
  abstract: string
  force?: boolean
}

// Google 翻译 API 配置（免费）
const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { paper_id, title, abstract, force = false }: TranslationRequest = await req.json()
    
    if (!paper_id || !title || !abstract) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: '缺少必需参数: paper_id, title, abstract' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 获取配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('缺少Supabase配置')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log(`开始快速翻译论文: ${paper_id}`)
    
    // 检查是否已存在翻译结果
    if (!force) {
      const { data: existingAnalysis, error: checkError } = await supabase
        .from('paper_analysis')
        .select('id, title_cn, abstract_cn, translation_status')
        .eq('paper_id', paper_id)
        .maybeSingle()
      
      if (checkError) {
        console.error('检查现有翻译失败:', checkError)
      } else if (existingAnalysis && existingAnalysis.translation_status === 'completed') {
        console.log('翻译已存在且未开启强制模式，跳过处理')
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              cached: true,
              title_cn: existingAnalysis.title_cn,
              abstract_cn: existingAnalysis.abstract_cn
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // 更新翻译状态为处理中
    await supabase
      .from('paper_analysis')
      .upsert({
        paper_id,
        translation_status: 'processing',
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })
    
    let titleCn = ''
    let abstractCn = ''
    
    // 使用 Google 翻译 API（免费）
    console.log('使用Google翻译API...')
    const startTime = Date.now()
    
    // 翻译标题
    titleCn = await googleTranslate(title)
    
    // 翻译摘要
    abstractCn = await googleTranslate(abstract)
    
    const processingTime = Date.now() - startTime
    console.log(`Google翻译完成，耗时: ${processingTime}ms`)
    
    // 提取标签（使用简单的关键词匹配，不需要大模型）
    const tags = extractTags(abstractCn + ' ' + titleCn)
    
    // 更新翻译结果
    const { error: updateError } = await supabase
      .from('paper_analysis')
      .upsert({
        paper_id,
        title_cn: titleCn,
        abstract_cn: abstractCn,
        translation_model: 'google-translate',
        translation_cost: 0,
        translation_status: 'completed',
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'paper_id'
      })
    
    if (updateError) {
      throw new Error(`更新翻译结果失败: ${updateError.message}`)
    }
    
    // 保存标签
    if (tags.length > 0) {
      await saveTagsForPaper(supabase, paper_id, tags)
    }
    
    console.log('快速翻译完成')
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title_cn: titleCn,
          abstract_cn: abstractCn,
          tags
        },
        message: '快速翻译完成'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('快速翻译失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'TRANSLATION_ERROR',
          message: error.message
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Google 翻译 API（免费）
async function googleTranslate(text: string): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'zh-CN',
    dt: 't',
    q: text
  })
  
  const response = await fetch(`${GOOGLE_TRANSLATE_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Google翻译API调用失败: ${response.status}`)
  }
  
  const result = await response.json()
  
  if (!result || !result[0]) {
    throw new Error('Google翻译返回空结果')
  }
  
  // 拼接翻译结果
  return result[0].map((item: any) => item[0]).join('')
}

// 简单标签提取（基于关键词匹配，不需要大模型）
function extractTags(text: string): string[] {
  const tags: string[] = []
  
  // 生物医学领域关键词映射
  const keywordMap: Record<string, string> = {
    'cancer': '癌症',
    'tumor': '肿瘤',
    'cell': '细胞生物学',
    'gene': '基因',
    'protein': '蛋白质',
    'dna': 'DNA',
    'rna': 'RNA',
    'virus': '病毒',
    'bacteria': '细菌',
    'immune': '免疫',
    'brain': '神经科学',
    'neuro': '神经科学',
    'heart': '心血管',
    'drug': '药物',
    'therapy': '治疗',
    'diagnosis': '诊断',
    'sequencing': '测序',
    'crispr': '基因编辑',
    'stem cell': '干细胞',
    'machine learning': '机器学习',
    'artificial intelligence': '人工智能',
    'algorithm': '算法',
    'bioinformatics': '生物信息学',
    'genomics': '基因组学',
    'proteomics': '蛋白质组学',
    'metabolomics': '代谢组学',
    'epigenetics': '表观遗传学',
    'microbiome': '微生物组'
  }
  
  const lowerText = text.toLowerCase()
  
  for (const [en, cn] of Object.entries(keywordMap)) {
    if (lowerText.includes(en)) {
      if (!tags.includes(cn)) {
        tags.push(cn)
      }
    }
  }
  
  // 限制标签数量
  return tags.slice(0, 5)
}

async function saveTagsForPaper(supabase: any, paperId: string, tagNames: string[]) {
  const names = Array.from(new Set((tagNames || []).map(n => (n || '').trim()).filter(Boolean)))
  for (const name of names) {
    try {
      const { data: existing } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
      let tagId = existing?.id
      if (!tagId) {
        const { data: inserted } = await supabase
          .from('tags')
          .upsert({ name }, { onConflict: 'name' })
          .select('id')
          .single()
        tagId = inserted?.id
      }
      if (!tagId) continue
      const { data: rel } = await supabase
        .from('paper_tags')
        .select('id')
        .eq('paper_id', paperId)
        .eq('tag_id', tagId)
        .maybeSingle()
      if (!rel) {
        await supabase.from('paper_tags').insert({ paper_id: paperId, tag_id: tagId })
      }
    } catch (e) {
      console.error('saveTagsForPaper error', e)
    }
  }
}
