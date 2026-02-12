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
    // 策略调整：如果数据量过大，优先使用“采样”策略（只统计最近的 N 条记录），
    // 而不是简单的“前 N 条”（旧数据）。
    // 由于 paper_tags 表通常没有时间戳，我们假设新插入的记录在物理存储或 ID 上通常较新，
    // 但最稳妥的是关联 papers 表按时间倒序。但关联查询开销大。
    // 折中方案：先获取 paper_tags 的总行数（估算），然后从后往前扫，或者只扫最后 10000 条。
    // 但 Supabase/PostgREST 的 range 是基于 OFFSET 的，对于大表，大 OFFSET 性能很差。
    // 所以，这里我们维持现有的“前向扫描”，但将熔断阈值提高，并增加超时控制。
    
    // 更好的 Fallback：只统计最近 2000 篇论文的标签（如果可能）
    // 但为了保持代码简单且修复“不更新”的问题，我们只需提高熔断阈值并优化并发。
    // 如果超过 10 万条，我们接受统计不完全准确，但不能失败。
    
    const pageSize = 5000 // 增大页面大小
    let offset = 0
    const countsById = new Map<string, number>()
    
    // 并行请求限制
    const MAX_PARALLEL = 5
    let hasMore = true
    
    // 熔断阈值提高到 50万 (Vercel 函数超时通常 10s，需谨慎)
    // 实际上，如果 RPC 失败，大概率是因为权限。
    // 如果数据真的很大，内存聚合肯定会超时。
    // 关键修复：不要让它无限跑，但也不能只跑旧数据。
    // 如果 RPC 失败，我们尝试调用另一个简单的 RPC 或者直接查 tags 表的 count（如果 tags 表有 count 字段）
    
    // 检查 tags 表是否有 cached_count 字段 (假设有优化)
    /*
    const { data: cachedTags } = await sb.from('tags').select('name, cached_count').order('cached_count', { ascending: false }).limit(20)
    if (cachedTags && cachedTags.length > 0) {
       // ...
    }
    */

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
      
      // 安全熔断：提高到 200,000 以覆盖更多数据
      // 注意：这仍然是权宜之计。真正的修复是修复 RPC。
      if (offset > 200000) break 
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
