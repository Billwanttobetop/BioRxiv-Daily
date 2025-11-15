import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminConsole() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [contact, setContact] = useState('')
  const [queue, setQueue] = useState<{ id: string; title: string }[]>([])
  const [progress, setProgress] = useState({ total: 0, done: 0, ok: 0, err: 0 })
  const [running, setRunning] = useState(false)

  const login = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/admin-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const text = await resp.text()
      const json = (() => { try { return JSON.parse(text) } catch { return { success: false, error: { message: text } } } })()
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

  const batchAnalyze = async () => {
    // 前端队列逐篇执行，避免后端 FUNCTION_INVOCATION_FAILED
    setMessage(null)
    if (queue.length === 0) {
      setMessage('请先“识别待翻译”')
      return
    }
    setRunning(true)
    setProgress({ total: queue.length, done: 0, ok: 0, err: 0 })
    const iv = Math.max(100, Math.min(5000, Number(interval) || 500))
    const resultsLocal: { id: string; ok: boolean; error?: string }[] = []
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i].id
      try {
        const { error } = await supabase.functions.invoke('analyze-paper-v2', { body: { paper_id: id } })
        if (error) throw error
        resultsLocal.push({ id, ok: true })
        setProgress(p => ({ ...p, done: p.done + 1, ok: p.ok + 1 }))
      } catch (e: any) {
        resultsLocal.push({ id, ok: false, error: e?.message || '调用失败' })
        setProgress(p => ({ ...p, done: p.done + 1, err: p.err + 1 }))
      }
      await new Promise(r => setTimeout(r, iv))
    }
    setResults(resultsLocal)
    setRunning(false)
    setMessage('批量分析完成')
  }

  const updateContact = async () => {
    if (!token) return
    setBusy(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/admin-update-contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contact })
      })
      const text = await resp.text()
      const json = (() => { try { return JSON.parse(text) } catch { return { success: false, error: { message: text } } } })()
      if (json.success) setMessage('联系方式已更新')
      else setMessage(json.error?.message || '更新失败')
    } catch (e: any) {
      setMessage(e?.message || '更新失败')
    } finally { setBusy(false) }
  }

  // UI 增强: 加载当前联系方式、可配置批量参数、结果列表
  const [currentContactLoaded, setCurrentContactLoaded] = useState(false)
  const [limit, setLimit] = useState(200)
  const [interval, setInterval] = useState(500)
  const [only_new, setOnlyNew] = useState(true)
  const [results, setResults] = useState<{ id: string; ok: boolean; error?: string }[]>([])

  const loadCurrentContact = async () => {
    try {
      const resp = await fetch('/api/admin-get-contact')
      const text = await resp.text()
      const json = (() => { try { return JSON.parse(text) } catch { return { success: false, error: { message: text } } } })()
      if (json.success) {
        setContact(json.contact || '')
        setCurrentContactLoaded(true)
      }
    } catch {}
  }
  if (!currentContactLoaded) loadCurrentContact()

  // 识别待翻译：读取 papers 与 paper_analysis，筛选未分析
  const identifyQueue = async () => {
    setBusy(true)
    setMessage('正在识别待翻译论文...')
    try {
      const { data: papers } = await supabase
        .from('papers')
        .select('id,title,created_at')
        .order('created_at', { ascending: false })
        .limit(Number(limit) || 200)
      const { data: analyzed } = await supabase
        .from('paper_analysis')
        .select('paper_id')
      const analyzedSet = new Set((analyzed || []).map(r => r.paper_id))
      const list = (papers || [])
        .filter(p => (only_new ? !analyzedSet.has(p.id) : true))
        .map(p => ({ id: p.id, title: p.title }))
      setQueue(list)
      setProgress({ total: list.length, done: 0, ok: 0, err: 0 })
      setMessage(`识别到 ${list.length} 篇待翻译`)
    } catch (e: any) {
      setMessage(e?.message || '识别失败')
    } finally {
      setBusy(false)
    }
  }

  const fetchLatestPapers = async () => {
    setBusy(true)
    setMessage('正在抓取最新论文...')
    try {
      const { error } = await supabase.functions.invoke('fetch-biorxiv-papers')
      if (error) throw error
      setMessage('抓取完成，正在识别待翻译...')
      await identifyQueue()
    } catch (e: any) {
      setMessage(e?.message || '抓取失败')
    } finally { setBusy(false) }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">管理员登录</h1>
        <div className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-amber-500 text-white rounded px-4 py-2 disabled:opacity-50" onClick={login} disabled={busy}>登录</button>
          {message && <div className="text-sm text-red-600">{message}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">管理员控制台</h1>
      <div className="space-y-3">
        <div className="border rounded p-4 space-y-2">
          <div className="font-medium">批量翻译（标题+摘要）</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-neutral-600">数量限制</label>
              <input className="w-full border rounded px-3 py-2" type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-neutral-600">单篇间隔(ms)</label>
              <input className="w-full border rounded px-3 py-2" type="number" value={interval} onChange={e => setInterval(Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <label className="text-xs text-neutral-600 mr-2">只处理未分析</label>
              <input type="checkbox" checked={only_new} onChange={e => setOnlyNew(e.target.checked)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="bg-neutral-800 text-white rounded px-4 py-2 disabled:opacity-50" onClick={identifyQueue} disabled={busy}>识别待翻译</button>
            <button className="bg-amber-500 text-white rounded px-4 py-2 disabled:opacity-50" onClick={batchAnalyze} disabled={busy || running || queue.length===0}>开始批量翻译</button>
            <button className="bg-neutral-100 text-neutral-700 rounded px-4 py-2 disabled:opacity-50" onClick={fetchLatestPapers} disabled={busy}>获取最新论文</button>
          </div>
          {progress.total > 0 && (
            <div className="mt-2">
              <div className="h-2 bg-neutral-200 rounded">
                <div className="h-2 bg-amber-500 rounded" style={{ width: `${Math.round((progress.done/progress.total)*100)}%` }}></div>
              </div>
              <div className="text-xs text-neutral-600 mt-1">{progress.done}/{progress.total} · 成功 {progress.ok} · 失败 {progress.err}</div>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-3 text-xs">
              {results.slice(0, 10).map(r => (
                <div key={r.id} className={r.ok ? 'text-green-700' : 'text-red-700'}>
                  {r.ok ? 'OK' : 'ERR'} · {r.id} {r.error ? `· ${r.error.substring(0, 80)}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">联系方式</label>
          <input className="w-full border rounded px-3 py-2 mt-1" placeholder="如邮箱/微信/Telegram链接" value={contact} onChange={e => setContact(e.target.value)} />
          <button className="mt-2 bg-neutral-800 text-white rounded px-4 py-2 disabled:opacity-50" onClick={updateContact} disabled={busy}>保存联系方式</button>
        </div>
        {message && <div className="text-sm text-neutral-700">{message}</div>}
      </div>
    </div>
  )
}

