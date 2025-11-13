import { useEffect, useState, useCallback } from 'react'
import Masonry from 'react-masonry-css'
import { Search, Tag as TagIcon, X, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react'
import { supabase, Paper, PaperAnalysis } from '@/lib/supabase'
import { PaperCard } from '@/components/PaperCard'
import { useAuth } from '@/contexts/AuthContext'

interface PaperWithData {
  paper: Paper
  analysis?: PaperAnalysis | null
  tags: string[]
}

export function HomePage() {
  const { user } = useAuth()
  const [papers, setPapers] = useState<PaperWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [fetchingPapers, setFetchingPapers] = useState(false)
  const [allTags, setAllTags] = useState<{ name: string; count: number }[]>([])
  const [tagsExpanded, setTagsExpanded] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const PAPERS_PER_PAGE = 50
  const DISABLE_TAGS_RPC = (import.meta.env.VITE_DISABLE_TAGS_RPC ?? 'true') === 'true'

  const fetchFavorites = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('paper_id')
        .eq('user_id', user.id)

      if (error) throw error
      setFavorites(new Set(data.map(fav => fav.paper_id)))
    } catch (error) {
      console.error('Error fetching favorites:', error)
    }
  }, [user])

  const loadPapers = useCallback(async ({ initialLoad = false }: { initialLoad?: boolean } = {}) => {
    const pageToLoad = initialLoad ? 1 : page + 1
    if (initialLoad) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const from = (pageToLoad - 1) * PAPERS_PER_PAGE
      const to = from + PAPERS_PER_PAGE - 1

      const { data: papersData, error: papersError } = await supabase
        .from('papers')
        .select('*')
        .order('published_date', { ascending: false })
        .range(from, to)

      if (papersError) throw papersError
      if (!papersData || papersData.length < PAPERS_PER_PAGE) {
        setHasMore(false)
      }

      const paperIds = papersData?.map(p => p.id) || []
      const [{ data: analysisData }, { data: paperTagsData }, { data: tagsData }] = await Promise.all([
        supabase.from('paper_analysis').select('*').in('paper_id', paperIds),
        supabase.from('paper_tags').select('*').in('paper_id', paperIds),
        supabase.from('tags').select('id, name').in('id', [...new Set((await supabase.from('paper_tags').select('tag_id').in('paper_id', paperIds)).data?.map(pt => pt.tag_id) || [])]),
      ])

      const tagIdToName = new Map<string, string>(tagsData?.map(tag => [tag.id, tag.name]))
      const paperTagsMap = new Map<string, string[]>()
      paperTagsData?.forEach(pt => {
        const paperId = pt.paper_id
        if (!paperTagsMap.has(paperId)) paperTagsMap.set(paperId, [])
        const tagName = tagIdToName.get(pt.tag_id)
        if (tagName) paperTagsMap.get(paperId)!.push(tagName)
      })

      const merged = papersData?.map(paper => ({
        paper,
        analysis: analysisData?.find(a => a.paper_id === paper.id) || null,
        tags: paperTagsMap.get(paper.id) || [],
      })) || []

      if (initialLoad) {
        setPapers(merged)
        setPage(1)
      } else {
        setPapers(prevPapers => [...prevPapers, ...merged])
        setPage(pageToLoad)
      }
    } catch (error) {
      console.error('Error loading papers:', error)
    } finally {
      if (initialLoad) setLoading(false)
      else setLoadingMore(false)
    }
  }, [page, user])

  // 根据当前已加载的论文列表计算热门标签的回退逻辑
  function computeFallbackTagsFromPapers() {
    const counts = new Map<string, number>()
    papers.forEach(p => {
      p.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1))
    })
    const fallback = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    setAllTags(fallback)
  }

  const loadPopularTags = useCallback(async () => {
    try {
      if (DISABLE_TAGS_RPC) {
        if (papers.length > 0) computeFallbackTagsFromPapers()
        return
      }
      const { data, error } = await supabase.rpc('get_popular_tags', { limit_count: 10 })
      if (error) throw error
      if (data && data.length > 0) {
        setAllTags(data)
      } else if (papers.length > 0) {
        computeFallbackTagsFromPapers()
      }
    } catch (error) {
      // 安静回退
      if (papers.length > 0) computeFallbackTagsFromPapers()
    }
  }, [papers])

  useEffect(() => {
    loadPapers({ initialLoad: true })
    loadPopularTags()
    if (user) fetchFavorites()
  }, [user])

  // 当论文已加载但热门标签仍为空时，自动计算回退标签
  useEffect(() => {
    if (papers.length > 0 && allTags.length === 0) {
      computeFallbackTagsFromPapers()
    }
  }, [papers, allTags])

  async function handleLoadMore() {
    if (!loadingMore && hasMore) {
      loadPapers({ initialLoad: false })
    }
  }

  async function handleAnalyze(paperId: string) {
    setAnalyzingId(paperId)
    try {
      // 直接调用analyze-paper-v2进行分析（包含标签提取）
      const { data, error } = await supabase.functions.invoke('analyze-paper-v2', {
        body: { paper_id: paperId }
      })

      if (error) {
        // 如果分析失败，显示友好提示
        if (error.message && error.message.includes('Missing MiniMax API key')) {
          alert('AI分析功能需要配置MiniMax API密钥，请联系管理员')
        } else {
          console.error('分析错误:', error)
          alert('分析失败，请稍后重试')
        }
        return
      }

      console.log('分析成功:', data)
      
      // 重新加载数据以显示新标签和分析
      await loadPapers({ initialLoad: true })
      await loadPopularTags()
    } catch (error: any) {
      console.error('Error analyzing paper:', error)
      if (error.message && error.message.includes('API key')) {
        alert('AI分析功能需要配置MiniMax API密钥，请联系管理员')
      } else {
        alert('分析失败，请稍后重试')
      }
    } finally {
      setAnalyzingId(null)
    }
  }

  async function handleFetchLatestPapers() {
    setFetchingPapers(true)
    try {
      // 调用fetch-biorxiv-papers获取最新论文，添加时间戳避免缓存
      const timestamp = Date.now();
      const { data, error } = await supabase.functions.invoke('fetch-biorxiv-papers', {
        body: { 
          limit: 20,
          timestamp: timestamp,
          pages: 3 // 请求3页内容以获取更多论文
        }
      })

      if (error) {
        console.error('获取论文错误:', error)
        alert('获取最新论文失败，请稍后重试')
        return
      }

      console.log('获取论文成功:', data)

      // 重新加载论文列表
      await loadPapers({ initialLoad: true })

      // 获取新论文的ID列表进行分析
      if (data && data.new_papers && data.new_papers.length > 0) {
        const newPaperIds = data.new_papers.map((paper: any) => paper.id)
        
        // 批量分析新论文
        for (const paperId of newPaperIds) {
          try {
            await supabase.functions.invoke('analyze-paper-v2', {
              body: { paper_id: paperId }
            })
          } catch (analysisError) {
            console.error(`分析论文 ${paperId} 失败:`, analysisError)
            // 继续分析其他论文，不中断流程
          }
        }

        // 重新加载标签和论文
        await loadPapers({ initialLoad: true })
        await loadPopularTags()
      }

      alert(`成功获取 ${data?.new_papers?.length || 0} 篇最新论文并完成解析！`)
    } catch (error: any) {
      console.error('Error fetching papers:', error)
      alert('获取最新论文失败，请稍后重试')
    } finally {
      setFetchingPapers(false)
    }
  }

  const filteredPapers = papers.filter(p => {
    // 标签筛选
    if (selectedTag && !p.tags.includes(selectedTag)) {
      return false
    }

    // 搜索筛选
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    
    // 检查标题（英文和中文）
    const titleMatch = p.paper.title.toLowerCase().includes(query) ||
                      p.analysis?.title_cn?.toLowerCase().includes(query)
    
    // 检查摘要（英文和中文）
    const abstractMatch = p.paper.abstract?.toLowerCase().includes(query) ||
                         p.analysis?.abstract_cn?.toLowerCase().includes(query)
    
    // 检查作者
    const authorMatch = p.paper.authors.some(a => a.toLowerCase().includes(query))
    
    // 检查机构
    const institutionMatch = p.analysis?.main_institutions?.some(inst => 
      inst.toLowerCase().includes(query)
    )
    
    // 检查标签
    const tagMatch = p.tags.some(tag => tag.toLowerCase().includes(query))
    
    return titleMatch || abstractMatch || authorMatch || institutionMatch || tagMatch
  })

  // 按日期分组论文
  const papersByDate = filteredPapers.reduce((groups, paper) => {
    const date = new Date(paper.paper.published_date)
    const dateKey = date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    })
    
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(paper)
    return groups
  }, {} as Record<string, PaperWithData[]>)

  // 转换日期分组为数组并按日期排序
  const dateGroups = Object.entries(papersByDate)
    .map(([date, papers]) => ({
      date,
      papers,
      isToday: date === new Date().toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'numeric', 
        day: 'numeric' 
      })
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 默认展开今天的日期
  useEffect(() => {
    const today = new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    })
    setExpandedDates(new Set([today]))
  }, [])

  const toggleDateExpansion = (date: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  const expandAllDates = () => {
    setExpandedDates(new Set(dateGroups.map(group => group.date)))
  }

  const collapseAllDates = () => {
    setExpandedDates(new Set())
  }

  const breakpointColumns = {
    default: 2,
    1100: 2,
    700: 1
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-neutral-600">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-neutral-200 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="搜索文献、作者、机构、标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm sm:text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* 标签云（始终显示容器，空时显示占位文案） */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-600">热门标签</span>
              </div>
              <button
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
              >
                {tagsExpanded ? (
                  <>收起 <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>展开 <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            </div>
            {tagsExpanded && (
              <div className="flex flex-wrap gap-2">
                {allTags.length > 0 ? (
                  allTags.map((tag) => (
                    <button
                      key={tag.name}
                      onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                      className={`text-xs px-3 py-1 rounded-full transition-colors ${
                        selectedTag === tag.name
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {tag.name} ({tag.count})
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">暂无热门标签</span>
                )}
                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full hover:bg-neutral-200 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    清除筛选
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 文献列表 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-800">
                BioRxiv 文献日报
              </h2>
              {/* 获取最新论文按钮 */}
              <button
                onClick={handleFetchLatestPapers}
                disabled={fetchingPapers}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                title="获取最新论文并自动解析"
              >
                {fetchingPapers ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">获取中...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">获取最新论文</span>
                    <span className="sm:hidden">获取</span>
                  </>
                )}
              </button>
            </div>
            <div>
              <p className="text-sm sm:text-base text-neutral-600">
                共 {filteredPapers.length} 篇文献
                {selectedTag && <span className="ml-2 text-blue-600">（标签: {selectedTag}）</span>}
              </p>
            </div>
          </div>
          {/* 日期控制按钮 */}
          {dateGroups.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={expandAllDates}
                className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
              >
                全部展开
              </button>
              <button
                onClick={collapseAllDates}
                className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full hover:bg-neutral-200 transition-colors"
              >
                全部收起
              </button>
            </div>
          )}
        </div>

        {/* 按日期分组的文献列表 */}
        <div className="space-y-6">
          {dateGroups.map(({ date, papers, isToday }) => {
            const isExpanded = expandedDates.has(date)
            return (
              <div key={date} className="bg-white rounded-lg shadow-sm border border-neutral-100">
                {/* 日期标题 */}
                <div className="sticky top-[73px] bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-6 py-4 z-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-lg font-bold ${isToday ? 'text-amber-600' : 'text-neutral-800'}`}>
                        {date}
                        {isToday && <span className="ml-2 text-sm font-normal text-amber-500">（今天）</span>}
                      </h3>
                      <span className="text-sm text-neutral-500">({papers.length}篇论文)</span>
                    </div>
                    <button
                      onClick={() => toggleDateExpansion(date)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          收起 <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          展开 <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 论文列表 */}
                {isExpanded && (
                  <div className="p-6">
                    <Masonry
                      breakpointCols={breakpointColumns}
                      className="flex -ml-4 w-auto"
                      columnClassName="pl-4 bg-clip-padding"
                    >
                      {papers.map(({ paper, analysis, tags }) => (
                        <PaperCard
                          key={paper.id}
                          paper={paper}
                          analysis={analysis}
                          tags={tags}
                          onAnalyze={handleAnalyze}
                          onTagClick={(tag) => setSelectedTag(tag)}
                          analyzing={analyzingId === paper.id}
                          initialIsFavorited={favorites.has(paper.id)}
                        />
                      ))}
                    </Masonry>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {hasMore && !loading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>加载中...</span>
                </>
              ) : (
                <span>加载更多</span>
              )}
            </button>
          </div>
        )}

        {filteredPapers.length === 0 && !loading && (
          <div className="text-center py-12 text-neutral-500">
            没有找到相关文献
          </div>
        )}
      </div>
    </div>
  )
}
