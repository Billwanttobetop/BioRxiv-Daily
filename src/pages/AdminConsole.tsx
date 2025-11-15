import { useState } from 'react'

export default function AdminConsole() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [contact, setContact] = useState('')

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

  const batchAnalyze = async () => {
    if (!token) return
    setBusy(true)
    setMessage('正在批量分析...')
    try {
      const resp = await fetch('/api/admin-batch-analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const json = await resp.json()
      if (json.success) {
        setMessage(`批量分析完成：总数 ${json.total}`)
      } else {
        setMessage(json.error?.message || '批量分析失败')
      }
    } catch (e: any) {
      setMessage(e?.message || '批量分析失败')
    } finally {
      setBusy(false)
    }
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
      const json = await resp.json()
      if (json.success) setMessage('联系方式已更新')
      else setMessage(json.error?.message || '更新失败')
    } catch (e: any) {
      setMessage(e?.message || '更新失败')
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">管理员控制台</h1>
      <div className="space-y-3">
        <button className="bg-amber-500 text-white rounded px-4 py-2 disabled:opacity-50" onClick={batchAnalyze} disabled={busy}>一键批量翻译（标题+摘要）</button>
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

