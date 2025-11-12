import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, Database, Settings, Brain, Play, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SiteSettingsView } from '@/components/SiteSettingsView'

interface Stats {
  totalPapers: number
  totalAnalyzed: number
  todayPapers: number
  totalUsers: number
  unanalyzedPapers: number
}

type TabType = 'overview' | 'settings'

export function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [stats, setStats] = useState<Stats>({
    totalPapers: 0,
    totalAnalyzed: 0,
    todayPapers: 0,
    totalUsers: 0,
    unanalyzedPapers: 0
  })
  const [fetching, setFetching] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 })
  const [analysisQueue, setAnalysisQueue] = useState<string[]>([])

  useEffect(() => {
    checkAdminStatus()
    loadStats()
  }, [user])

  async function checkAdminStatus() {
    if (!user) {
      setAdminCheckLoading(false)
      return
    }

    try {
      const { data: authData } = await supabase.auth.getSession()
      if (!authData.session) {
        setIsAdmin(false)
        setAdminCheckLoading(false)
        return
      }

      const { data, error } = await supabase.functions.invoke('admin-verify', {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      })

      if (error || data?.error) {
        setIsAdmin(false)
      } else {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error('Admin verification error:', error)
      setIsAdmin(false)
    } finally {
      setAdminCheckLoading(false)
    }
  }

  async function loadStats() {
    try {
      // 总文献数
      const { count: totalPapers } = await supabase
        .from('papers')
        .select('*', { count: 'exact', head: true })

      // 已分析数
      const { count: totalAnalyzed } = await supabase
        .from('paper_analysis')
        .select('*', { count: 'exact', head: true })

      // 今日文献数
      const today = new Date().toISOString().split('T')[0]
      const { count: todayPapers } = await supabase
        .from('papers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today)

      // 用户数
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalPapers: totalPapers || 0,
        totalAnalyzed: totalAnalyzed || 0,
        todayPapers: todayPapers || 0,
        totalUsers: totalUsers || 0,
        unanalyzedPapers: (totalPapers || 0) - (totalAnalyzed || 0)
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  async function handleManualFetch() {
    setFetching(true)
    try {
      // 添加时间戳避免缓存，获取更多页面
      const timestamp = Date.now();
      const { data, error } = await supabase.functions.invoke('fetch-biorxiv-papers', {
        body: {
          timestamp: timestamp,
          pages: 5 // 管理员手动抓取时获取更多页面
        }
      })
      
      if (error) throw error

      const newPapersCount = data?.data?.new_papers?.length || 0
      alert(`抓取成功！共抓取 ${data?.data?.total_fetched || 0} 篇，新增 ${newPapersCount} 篇`)
      loadStats()

      // 如果有新论文，自动触发批量AI分析
      if (newPapersCount > 0) {
        const newPaperIds = data.data.new_papers.map((paper: any) => paper.id)
        await startBatchAnalysis(newPaperIds)
      }
    } catch (error: any) {
      console.error('Error fetching papers:', error)
      alert('抓取失败：' + error.message)
    } finally {
      setFetching(false)
    }
  }

  async function startBatchAnalysis(paperIds: string[]) {
    setBatchAnalyzing(true)
    setAnalysisProgress({ current: 0, total: paperIds.length })
    setAnalysisQueue([...paperIds])

    // 使用队列机制逐个处理，避免同时发起太多请求
    for (let i = 0; i < paperIds.length; i++) {
      const paperId = paperIds[i]
      setAnalysisProgress({ current: i, total: paperIds.length })

      try {
        await supabase.functions.invoke('analyze-paper-v2', {
          body: { paper_id: paperId }
        })
        console.log(`论文 ${paperId} 分析完成`)
      } catch (error) {
        console.error(`论文 ${paperId} 分析失败:`, error)
        // 继续分析其他论文，不中断流程
      }

      // 添加延迟避免API限制
      if (i < paperIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1秒延迟
      }
    }

    setAnalysisProgress({ current: paperIds.length, total: paperIds.length })
    setBatchAnalyzing(false)
    setAnalysisQueue([])
    loadStats() // 重新加载统计数据
    
    alert(`批量AI分析完成！共分析了 ${paperIds.length} 篇论文`)
  }

  async function handleBatchAnalysis() {
    try {
      // 获取所有未分析的论文
      const analyzedIds = await getAnalyzedPaperIds()
      const { data: unanalyzedPapers, error } = await supabase
        .from('papers')
        .select('id')
        .not('id', 'in', `(${analyzedIds.join(',')})`)

      if (error) throw error

      const paperIds = unanalyzedPapers?.map(p => p.id) || []
      if (paperIds.length === 0) {
        alert('没有未分析的论文')
        return
      }

      if (confirm(`确定要对 ${paperIds.length} 篇未分析的论文进行批量AI分析吗？\n这可能需要较长时间。`)) {
        await startBatchAnalysis(paperIds)
      }
    } catch (error: any) {
      console.error('Error getting unanalyzed papers:', error)
      alert('获取未分析论文失败：' + error.message)
    }
  }

  async function getAnalyzedPaperIds(): Promise<string[]> {
    const { data, error } = await supabase
      .from('paper_analysis')
      .select('paper_id')

    if (error) throw error
    return data?.map(row => row.paper_id) || []
  }

  if (adminCheckLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">验证管理员权限中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">请先登录</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">您没有管理员权限</div>
          <p className="text-neutral-600 mb-4">只有管理员才能访问此页面</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">
            管理后台
          </h2>
          <p className="text-neutral-600">
            系统监控与管理
          </p>
        </div>

        {/* 标签页导航 */}
        <div className="mb-6 border-b border-neutral-200">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-amber-500 text-amber-600 font-semibold'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>系统概览</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-amber-500 text-amber-600 font-semibold'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>站点设置</span>
              </div>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        {activeTab === 'overview' && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">总文献数</span>
                  <Database className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-neutral-800">{stats.totalPapers}</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">已分析</span>
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-neutral-800">{stats.totalAnalyzed}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {stats.totalPapers > 0 
                    ? `${((stats.totalAnalyzed / stats.totalPapers) * 100).toFixed(1)}%` 
                    : '0%'}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">今日新增</span>
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-neutral-800">{stats.todayPapers}</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">用户数</span>
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-3xl font-bold text-neutral-800">{stats.totalUsers}</div>
              </div>
            </div>

            {/* 操作区 */}
            <div className="space-y-6">
              {/* 批量AI分析区域 - 最显眼 */}
              <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <Brain className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">批量AI分析中心</h3>
                      <p className="text-purple-100">一键分析所有未处理的论文</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{stats.unanalyzedPapers}</div>
                    <div className="text-sm text-purple-100">篇未分析</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-purple-100">
                    {stats.unanalyzedPapers > 0 
                      ? `当前有 ${stats.unanalyzedPapers} 篇论文等待AI分析，点击按钮开始批量处理` 
                      : '所有论文都已完成分析！'
                    }
                  </div>
                  <button
                    onClick={handleBatchAnalysis}
                    disabled={batchAnalyzing || fetching || stats.unanalyzedPapers === 0}
                    className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                  >
                    <Brain className="w-5 h-5" />
                    {batchAnalyzing ? '分析中...' : '开始批量分析'}
                  </button>
                </div>

                {/* 批量AI分析进度 */}
                {batchAnalyzing && (
                  <div className="mt-4 p-4 bg-white/10 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">分析进度</span>
                      <span className="text-sm">
                        {analysisProgress.current} / {analysisProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-3">
                      <div 
                        className="bg-white h-3 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${analysisProgress.total > 0 ? (analysisProgress.current / analysisProgress.total) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-purple-100 mt-2">
                      正在分析第 {analysisProgress.current + 1} 篇论文，预计还需 {Math.ceil((analysisProgress.total - analysisProgress.current) / 60)} 分钟...
                    </p>
                  </div>
                )}
              </div>

              {/* 手动操作区域 */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-neutral-100">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">手动操作</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-amber-800">手动抓取文献</h4>
                      <p className="text-sm text-amber-600">从BioRxiv抓取最新的文献</p>
                      {batchAnalyzing && (
                        <p className="text-sm text-amber-600 mt-1">
                          抓取完成后将自动进行批量AI分析
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleManualFetch}
                      disabled={fetching || batchAnalyzing}
                      className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                      {fetching ? '抓取中...' : '立即抓取'}
                    </button>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">定时任务状态</h4>
                    <p className="text-sm text-blue-700">
                      系统已配置每天早上 8:00 自动抓取文献
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'settings' && <SiteSettingsView />}
      </div>
    </div>
  )
}
