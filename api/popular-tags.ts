import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const supabaseUrl = process.env.SUPABASE_URL
  // 优先使用 Service Key，如果缺失则回退到 Anon Key (只要 RPC 设置了 SECURITY DEFINER，Anon Key 也能工作)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    res.status(200).json({ success: false, error: { message: 'Supabase not configured (Missing URL or Key)' } })
    return
  }
  const sb = createClient(supabaseUrl, supabaseKey)
  try {
    // 优先尝试 RPC (高性能)
    // Try both new and old function names
    // 强制使用 SECURITY DEFINER 的 RPC，并传入 Anon Key 如果需要
    let rpcResult = await sb.rpc('get_global_popular_tags', { limit_count: 20 })
    
    // 如果失败且错误不是由于函数不存在（例如权限错误），则尝试 fallback
    if (rpcResult.error) {
       console.warn('RPC failed:', rpcResult.error)
       // 继续执行 fallback 逻辑
    } else if (rpcResult.data && Array.isArray(rpcResult.data) && rpcResult.data.length > 0) {
      const tags = rpcResult.data.map((row: any) => ({ name: row.name, count: Number(row.count || 0) }))
      res.status(200).json({ success: true, tags })
      return
    }

    // Fallback: 内存聚合 (优化版)
    // 1. 仅拉取 tag_id 统计计数 (避免拉取 tags 表)
    // 2. 排序取前20
    // 3. 仅拉取前20个 tag 的 name
    const pageSize = 2000 // 增大页面大小以减少请求次数
    let offset = 0
    const countsById = new Map<string, number>()
    
    // 并行请求限制
    const MAX_PARALLEL = 3
    let hasMore = true

    while (hasMore) {
      const promises = []
      for (let i = 0; i < MAX_PARALLEL; i++) {
        promises.push(
          sb.from('paper_tags')
            .select('tag_id')
            .range(offset + i * pageSize, offset + (i + 1) * pageSize - 1)
        )
      }
      
      const results = await Promise.all(promises)
      let currentBatchCount = 0
      
      for (const { data, error } of results) {
        if (error) continue
        const list = (data as { tag_id: string }[] | null) || []
        if (list.length === 0) continue
        currentBatchCount += list.length
        list.forEach(r => {
          countsById.set(r.tag_id, (countsById.get(r.tag_id) || 0) + 1)
        })
      }

      if (currentBatchCount < pageSize * MAX_PARALLEL) {
        hasMore = false
      }
      offset += pageSize * MAX_PARALLEL
      
      // 安全熔断：如果数据量过大 (>10万)，暂时停止以避免超时
      if (offset > 100000) break 
    }

    // 排序取 Top 20 IDs
    const topIds = Array.from(countsById.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(e => e[0])

    if (topIds.length === 0) {
      res.status(200).json({ success: true, tags: [] })
      return
    }

    // 获取 Name
    const { data: tagsData } = await sb.from('tags').select('id,name').in('id', topIds)
    const idToName = new Map<string, string>((tagsData || []).map(t => [t.id, t.name]))

    const aggregated = topIds
      .map(id => ({ name: idToName.get(id), count: countsById.get(id) || 0 }))
      .filter(t => t.name) // 过滤掉找不到名字的
      .map(t => ({ name: t.name!, count: t.count }))

    res.status(200).json({ success: true, tags: aggregated })
  } catch (e: any) {
    res.status(200).json({ success: false, error: { message: e?.message || '未知错误' } })
  }
}
