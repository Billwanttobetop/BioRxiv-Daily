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

// 百度翻译 API 配置
const BAIDU_TRANSLATE_URL = 'https://fanyi-api.baidu.com/api/trans/vip/translate'

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
    const baiduAppId = Deno.env.get('BAIDU_APP_ID')
    const baiduSecretKey = Deno.env.get('BAIDU_SECRET_KEY')
    
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
    
    // 优先使用百度翻译（速度快、成本低）
    if (baiduAppId && baiduSecretKey) {
      console.log('使用百度翻译API...')
      const startTime = Date.now()
      
      // 批量翻译：标题和摘要一起翻译
      const combinedText = `${title}\n${abstract}`
      const translated = await baiduTranslate(combinedText, baiduAppId, baiduSecretKey)
      
      const processingTime = Date.now() - startTime
      console.log(`百度翻译完成，耗时: ${processingTime}ms`)
      
      // 分离标题和摘要（按换行符分割）
      const parts = translated.split('\n')
      titleCn = parts[0] || title
      abstractCn = parts.slice(1).join('\n') || abstract
      
    } else {
      // 没有百度翻译配置时，使用简单的占位符
      console.log('未配置百度翻译API，跳过翻译')
      return new Response(
        JSON.stringify({
          success: true,
          data: { skipped: true, reason: '翻译API未配置' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 提取标签（使用简单的关键词匹配，不需要大模型）
    const tags = extractTags(abstractCn + ' ' + titleCn)
    
    // 更新翻译结果
    const { error: updateError } = await supabase
      .from('paper_analysis')
      .upsert({
        paper_id,
        title_cn: titleCn,
        abstract_cn: abstractCn,
        translation_model: 'baidu-translate',
        translation_cost: 0.0001, // 百度翻译成本低
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

// 百度翻译 API
async function baiduTranslate(text: string, appId: string, secretKey: string): Promise<string> {
  const salt = Date.now().toString()
  const sign = await generateBaiduSign(appId, text, salt, secretKey)
  
  const params = new URLSearchParams({
    q: text,
    from: 'en',
    to: 'zh',
    appid: appId,
    salt: salt,
    sign: sign
  })
  
  const response = await fetch(`${BAIDU_TRANSLATE_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`百度翻译API调用失败: ${response.status}`)
  }
  
  const result = await response.json()
  
  if (result.error_code) {
    throw new Error(`百度翻译错误: ${result.error_code} - ${result.error_msg}`)
  }
  
  if (!result.trans_result || result.trans_result.length === 0) {
    throw new Error('百度翻译返回空结果')
  }
  
  // 拼接翻译结果
  return result.trans_result.map((item: any) => item.dst).join('\n')
}

// 生成百度翻译签名
async function generateBaiduSign(appId: string, query: string, salt: string, secretKey: string): Promise<string> {
  const str = appId + query + salt + secretKey
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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
