import { useState, useEffect, useRef } from 'react'
import { supabase, saveTagsForPaper } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  PlayCircle, 
  Database, 
  RotateCw,
  RefreshCw,
  Tags,
  AlertCircle,
  CheckCircle2,
  ListFilter
} from 'lucide-react'

// --- Components ---

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-neutral-100 flex items-center gap-4">
      <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <div className="text-sm text-neutral-500">{title}</div>
        <div className="text-2xl font-semibold text-neutral-800">{value}</div>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg ${
        active 
          ? 'bg-amber-50 text-amber-700' 
          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  )
}

export default function AdminConsole() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    totalPapers: 0,
    analyzedCount: 0,
    tagsCount: 0,
    pendingCount: 0
  })

  // Batch State
  const [queue, setQueue] = useState<{ id: string; title: string; abstract?: string | null }[]>([])
  const [progress, setProgress] = useState({ total: 0, done: 0, ok: 0, err: 0 })
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const [results, setResults] = useState<{ id: string; ok: boolean; error?: string }[]>([])
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'batch' | 'settings'>('dashboard')

  // Settings
  const [contact, setContact] = useState('')
  const [limit, setLimit] = useState(200)
  const [interval, setInterval] = useState(500)
  const [only_new, setOnlyNew] = useState(true)
  const [force_mode, setForceMode] = useState(false)

  // Initial Load
  useEffect(() => {
    if (token) {
      loadStats()
      loadCurrentContact()
    }
  }, [token])

  const loadStats = async () => {
    try {
      const { count: total } = await supabase.from('papers').select('*', { count: 'exact', head: true })
      const { count: analyzed } = await supabase.from('paper_analysis').select('*', { count: 'exact', head: true })
      const { count: tags } = await supabase.from('tags').select('*', { count: 'exact', head: true })
      
      setStats({
        totalPapers: total || 0,
        analyzedCount: analyzed || 0,
        tagsCount: tags || 0,
        pendingCount: (total || 0) - (analyzed || 0)
      })
    } catch (e) {
      console.error('Failed to load stats', e)
    }
  }

  const login = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/admin-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const json = await resp.json()
      if (json.success) {
        localStorage.setItem('admin_token', json.token)
        setToken(json.token)
      } else {
        setMessage(json.error?.message || '登录失败')
      }
    } catch (e: any) {
      setMessage(e?.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
  }

  // --- Actions ---

  const identifyQueue = async () => {
    setBusy(true)
    setMessage('正在识别待翻译论文...')
    try {
      const { data: papers } = await supabase
        .from('papers')
        .select('id,title,abstract,created_at')
        .order('created_at', { ascending: false })
        .limit(Number(limit) || 200)
      
      // If "only_new" is checked, filter out already analyzed ones
      let list = papers || []
      if (only_new) {
        const { data: analyzed } = await supabase.from('paper_analysis').select('paper_id')
        const analyzedSet = new Set((analyzed || []).map(r => r.paper_id))
        list = list.filter(p => !analyzedSet.has(p.id))
      }
      
      const queueList = list.map(p => ({ id: p.id, title: p.title, abstract: p.abstract }))
      setQueue(queueList)
      setProgress({ total: queueList.length, done: 0, ok: 0, err: 0 })
      setMessage(`识别到 ${queueList.length} 篇待翻译`)
    } catch (e: any) {
      setMessage(e?.message || '识别失败')
    } finally {
      setBusy(false)
    }
  }

  const batchAnalyze = async () => {
    if (queue.length === 0) {
      setMessage('请先“识别待翻译”')
      return
    }
    setRunning(true)
    runningRef.current = true
    setMessage('开始批量处理...')
    const iv = Math.max(100, Math.min(5000, Number(interval) || 500))
    const resultsLocal: { id: string; ok: boolean; error?: string }[] = []
    
    for (let i = 0; i < queue.length; i++) {
      if (!runningRef.current) break 
      
      const { id, title, abstract } = queue[i]
      try {
        const { data, error } = await supabase.functions.invoke('paper-analyze', { 
          body: { paper_id: id, title, abstract, force: force_mode } 
        })
        if (error) throw error
        if (data?.data?.skipped) throw new Error(data?.data?.reason || 'DeepSeek未配置，任务被跳过')
        
        // 2. Backup: Extract Tags (redundant now but kept for safety)
        try {
          const resp = await fetch('/api/extract-tags', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, abstract })
          })
          const json = await resp.json()
          if (json.success && Array.isArray(json.tags)) {
            await saveTagsForPaper(id, json.tags)
          }
        } catch {}

        const [{ data: pa }, { count: tagCount }] = await Promise.all([
          supabase.from('paper_analysis').select('translation_status,title_cn,abstract_cn,analyzed_at').eq('paper_id', id).maybeSingle(),
          supabase.from('paper_tags').select('*', { count: 'exact', head: true }).eq('paper_id', id)
        ])
        const ok = !!pa && pa.translation_status === 'completed' && !!pa.title_cn && !!pa.abstract_cn && (tagCount || 0) > 0
        if (!ok) throw new Error('验证失败：翻译或标签未写入')
        resultsLocal.unshift({ id, ok: true })
        setProgress(p => ({ ...p, done: p.done + 1, ok: p.ok + 1 }))
      } catch (e: any) {
        resultsLocal.unshift({ id, ok: false, error: e?.message || '调用失败' })
        setProgress(p => ({ ...p, done: p.done + 1, err: p.err + 1 }))
      }
      setResults([...resultsLocal]) // Update UI
      await new Promise(r => setTimeout(r, iv))
    }
    setRunning(false)
    runningRef.current = false
    setMessage('批量任务结束')
    loadStats() // Refresh stats
  }

  const stopBatch = () => {
    runningRef.current = false
    setRunning(false)
    setMessage('正在停止...')
  }

  const fetchLatestPapers = async () => {
    setBusy(true)
    setMessage('正在抓取最新论文...')
    try {
      const { error } = await supabase.functions.invoke('fetch-biorxiv-papers')
      if (error) throw error
      setMessage('抓取完成')
      loadStats()
    } catch (e: any) {
      setMessage(e?.message || '抓取失败')
    } finally { setBusy(false) }
  }

  const backfillTags = async () => {
    setBusy(true)
    setMessage('正在补齐缺少标签的论文...')
    try {
      const { data, error } = await supabase.functions.invoke('backfill-missing-tags', {
        body: { limit: Number(limit) || 500 }
      })
      if (error) throw error
      if (data?.success) {
        setMessage(`补齐完成：处理 ${data.processed} 篇`)
        loadStats()
      } else {
        setMessage(data?.error?.message || '补齐失败')
      }
    } catch (e: any) {
      setMessage(e?.message || '补齐失败')
    } finally { setBusy(false) }
  }

  const loadCurrentContact = async () => {
    try {
      const resp = await fetch('/api/admin-get-contact')
      const json = await resp.json()
      if (json.success) setContact(json.contact || '')
    } catch {}
  }

  const updateContact = async () => {
    setBusy(true)
    try {
      const resp = await fetch('/api/admin-update-contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contact })
      })
      const json = await resp.json()
      if (json.success) setMessage('联系方式已更新')
      else setMessage(json.error?.message || '更新失败')
    } catch (e: any) {
      setMessage(e?.message || '更新失败')
    } finally { setBusy(false) }
  }

  // --- Render ---

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900">BioRxiv 日报</h1>
            <p className="text-neutral-500 mt-2">管理员后台登录</p>
          </div>
          <div className="space-y-4">
            <input className="w-full border border-neutral-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="w-full border border-neutral-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button className="w-full bg-amber-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-amber-600 transition-colors disabled:opacity-50" onClick={login} disabled={busy}>登录</button>
            {message && <div className="text-sm text-red-600 text-center bg-red-50 py-2 rounded">{message}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-neutral-200 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-neutral-100">
          <h1 className="text-xl font-bold text-neutral-900">BioRxiv Admin</h1>
          <p className="text-xs text-neutral-400 mt-1">管理控制台</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="仪表盘" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
          <SidebarItem icon={ListFilter} label="批量任务" active={currentTab === 'batch'} onClick={() => setCurrentTab('batch')} />
          <SidebarItem icon={Settings} label="系统设置" active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} />
        </nav>
        <div className="p-4 border-t border-neutral-100">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-neutral-200 p-4 flex justify-between items-center">
          <span className="font-bold">BioRxiv Admin</span>
          <button onClick={logout}><LogOut className="w-5 h-5 text-neutral-500" /></button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* 顶部状态提示 */}
            {message && (
              <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded-lg border border-amber-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5" />
                {message}
              </div>
            )}

            {currentTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 mb-6">概览</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="论文总数" value={stats.totalPapers} icon={Database} color="bg-blue-500" />
                    <StatCard title="已分析" value={stats.analyzedCount} icon={CheckCircle2} color="bg-green-500" />
                    <StatCard title="待处理" value={stats.pendingCount} icon={RotateCw} color="bg-amber-500" />
                    <StatCard title="标签总数" value={stats.tagsCount} icon={Tags} color="bg-purple-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-sm border border-neutral-100 p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-500" />
                      数据更新
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-500">从 BioRxiv 抓取最新论文元数据。</p>
                      <button 
                        onClick={fetchLatestPapers} 
                        disabled={busy}
                        className="w-full bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      >
                        {busy ? '执行中...' : '立即抓取最新论文'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-neutral-100 p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Tags className="w-5 h-5 text-purple-500" />
                      标签维护
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-500">为缺少标签的历史文章自动补齐标签。</p>
                      <button 
                        onClick={backfillTags} 
                        disabled={busy}
                        className="w-full bg-purple-50 text-purple-600 border border-purple-100 py-2 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                      >
                        {busy ? '执行中...' : '补齐缺失标签'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'batch' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
                  <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold">批量任务执行器</h2>
                    {running && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">运行中</span>}
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">单次处理数量</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={limit} onChange={e => setLimit(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">请求间隔 (ms)</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={interval} onChange={e => setInterval(Number(e.target.value))} />
                      </div>
                      <div className="flex items-center pt-5 gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={only_new} onChange={e => setOnlyNew(e.target.checked)} className="rounded text-amber-500 focus:ring-amber-500" />
                          <span className="text-sm text-neutral-700">仅处理未分析论文</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={force_mode} onChange={e => setForceMode(e.target.checked)} className="rounded text-red-500 focus:ring-red-500" />
                          <span className="text-sm text-red-700 font-medium">强制重新翻译 (覆盖现有)</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={identifyQueue} 
                        disabled={busy || running}
                        className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium text-sm flex items-center gap-2"
                      >
                        <ListFilter className="w-4 h-4" />
                        1. 识别待处理队列
                      </button>
                      <button 
                        onClick={batchAnalyze} 
                        disabled={busy || running || queue.length === 0}
                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlayCircle className="w-4 h-4" />
                        2. 开始批量分析 ({queue.length})
                      </button>
                      {running && (
                        <button 
                          onClick={stopBatch} 
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm flex items-center gap-2"
                        >
                          停止
                        </button>
                      )}
                    </div>

                    {/* Progress */}
                    {progress.total > 0 && (
                      <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-xs text-neutral-500">
                          <span>进度: {Math.round((progress.done/progress.total)*100)}%</span>
                          <span>成功: {progress.ok} / 失败: {progress.err}</span>
                        </div>
                        <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 transition-all duration-300 ease-out"
                            style={{ width: `${(progress.done/progress.total)*100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Logs */}
                    <div className="border rounded-lg bg-neutral-900 text-neutral-300 font-mono text-xs h-64 overflow-y-auto p-4 space-y-1">
                      {results.length === 0 ? (
                        <div className="text-neutral-600 italic">暂无日志...</div>
                      ) : (
                        results.map((r, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-neutral-500">[{new Date().toLocaleTimeString()}]</span>
                            <span className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.ok ? 'SUCCESS' : 'FAILED'}</span>
                            <span>{r.id}</span>
                            {r.error && <span className="text-red-400">- {r.error}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'settings' && (
              <div className="bg-white rounded-lg shadow-sm border border-neutral-100 p-6 animate-in fade-in">
                <h2 className="text-xl font-bold mb-6">系统设置</h2>
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">底部联系方式</label>
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 border rounded-lg px-3 py-2" 
                        placeholder="如：admin@example.com" 
                        value={contact} 
                        onChange={e => setContact(e.target.value)} 
                      />
                      <button 
                        onClick={updateContact}
                        disabled={busy}
                        className="px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors text-sm"
                      >
                        保存
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">显示在网站底部的“联系我们”区域。</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
