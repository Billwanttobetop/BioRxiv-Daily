import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { UsersManagement } from '@/components/UsersManagement'
import { APILogsView } from '@/components/APILogsView'
import { SystemLogsView } from '@/components/SystemLogsView'
import { SystemConfigsView } from '@/components/SystemConfigsView'

interface Stats {
  totalPapers: number
  newPapersToday: number
  totalApiCallsToday: number
  totalTokensToday: number
  totalCostToday: string
}

interface TopFunction {
  name: string
  count: number
}

interface VisitStats {
  pv: number;
  uv: number;
  topPages: { path: string; count: number }[];
  recentVisits: { created_at: string; path: string; ip_address: string }[];
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [topFunctions, setTopFunctions] = useState<TopFunction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'api-logs' | 'system-logs' | 'configs'>('dashboard')
  const [visitStats, setVisitStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    verifyAdminAndLoadData()
  }, [])

  const verifyAdminAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/admin/login')
        return
      }

      // Verify admin
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('admin-verify', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (verifyError || verifyData?.error) {
        navigate('/admin/login')
        return
      }

      // Load stats
      const { data: statsData, error: statsError } = await supabase.functions.invoke('admin-get-stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (!statsError && statsData?.data) {
        setStats(statsData.data.overview)
        setTopFunctions(statsData.data.topFunctions || [])
      }
      // Load visit stats
      const { data: visitStatsData, error: visitStatsError } = await supabase.functions.invoke('get-visit-stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!visitStatsError && visitStatsData) {
        setVisitStats(visitStatsData);
      }

    } catch (error) {
      console.error('Failed to load admin data:', error)
      navigate('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800">管理后台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-neutral-600 hover:text-neutral-800"
              >
                返回首页
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-300"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              仪表盘
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('api-logs')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'api-logs'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              API日志
            </button>
            <button
              onClick={() => setActiveTab('system-logs')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'system-logs'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              系统日志
            </button>
            <button
              onClick={() => setActiveTab('configs')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'configs'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-800'
              }`}
            >
              系统配置
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Visit Stats */}
            {visitStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-neutral-600">今日PV</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2">{visitStats.pv}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-neutral-600">今日UV</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2">{visitStats.uv}</p>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">文献总数</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-2">{stats.totalPapers}</p>
                    <p className="text-sm text-amber-600 mt-1">今日新增 {stats.newPapersToday}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">今日API调用</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-2">{stats.totalApiCallsToday}</p>
                    <p className="text-sm text-neutral-600 mt-1">{stats.totalTokensToday} tokens</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">今日API费用</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-2">${stats.totalCostToday}</p>
                    <p className="text-sm text-neutral-600 mt-1">USD</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Visits */}
            {visitStats && visitStats.recentVisits.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">最近访问记录</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {visitStats.recentVisits.map((visit, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">{new Date(visit.created_at).toLocaleTimeString('zh-CN')}</span>
                        <span className="font-medium text-neutral-800 truncate" title={visit.path}>{visit.path}</span>
                      </div>
                      <span className="text-neutral-600 font-mono text-xs">{visit.ip_address}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Functions */}
            {topFunctions.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">热门功能（近7天）</h3>
                <div className="space-y-3">
                  {topFunctions.map((func, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">{func.name}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-neutral-200 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{
                              width: `${(func.count / topFunctions[0].count) * 100}%`
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-neutral-800 w-12 text-right">
                          {func.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && <UsersManagement />}
        {activeTab === 'api-logs' && <APILogsView />}
        {activeTab === 'system-logs' && <SystemLogsView />}
        {activeTab === 'configs' && <SystemConfigsView />}
      </div>
    </div>
  )
}
