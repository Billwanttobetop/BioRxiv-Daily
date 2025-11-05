import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  username: string
  full_name: string
  email: string
  created_at: string
  last_sign_in_at: string
  activity_count: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    loadUsers()
  }, [pagination.page, search])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase.functions.invoke('admin-get-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          page: pagination.page,
          limit: pagination.limit,
          search
        }
      })

      if (!error && data?.data) {
        setUsers(data.data.users)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '从未'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const handleResetPassword = async (userId: string) => {
    if (!confirm('确定要重置该用户的密码吗？新密码将在操作后显示。')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          userId,
          action: 'reset_password',
          data: {}
        }
      })

      if (!error && data?.data) {
        alert(`密码已重置\n新密码：${data.data.newPassword}\n\n请复制并安全保存此密码，关闭后将无法再次查看。`)
      } else {
        throw new Error('重置密码失败')
      }
    } catch (error) {
      console.error('Reset password error:', error)
      alert('重置密码失败，请重试')
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm('确定要封禁该用户吗？')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase.functions.invoke('admin-update-user', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          userId,
          action: 'ban_user',
          data: {}
        }
      })

      if (!error) {
        alert('用户已封禁')
        setSelectedUser(null)
        loadUsers()
      } else {
        throw new Error('封禁用户失败')
      }
    } catch (error) {
      console.error('Ban user error:', error)
      alert('封禁用户失败，请重试')
    }
  }

  const handleUnbanUser = async (userId: string) => {
    if (!confirm('确定要解除该用户的封禁吗？')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase.functions.invoke('admin-update-user', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          userId,
          action: 'unban_user',
          data: {}
        }
      })

      if (!error) {
        alert('已解除封禁')
        setSelectedUser(null)
        loadUsers()
      } else {
        throw new Error('解除封禁失败')
      }
    } catch (error) {
      console.error('Unban user error:', error)
      alert('解除封禁失败，请重试')
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索用户名或邮箱..."
              className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  最后登录
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  活动次数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-neutral-500">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-neutral-500">
                    暂无用户
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-neutral-900">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-sm text-neutral-500">@{user.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {user.activity_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-amber-600 hover:text-amber-900"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-neutral-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-700">
                  显示第 <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> 到{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> 条，
                  共 <span className="font-medium">{pagination.total}</span> 条
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-neutral-300 bg-white text-sm font-medium text-neutral-700">
                    第 {pagination.page} / {pagination.totalPages} 页
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-neutral-800">用户详情</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600">用户ID</label>
                <p className="text-neutral-800">{selectedUser.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">用户名</label>
                <p className="text-neutral-800">{selectedUser.username}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">姓名</label>
                <p className="text-neutral-800">{selectedUser.full_name || '未设置'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">邮箱</label>
                <p className="text-neutral-800">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">注册时间</label>
                <p className="text-neutral-800">{formatDate(selectedUser.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">最后登录</label>
                <p className="text-neutral-800">{formatDate(selectedUser.last_sign_in_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">活动次数</label>
                <p className="text-neutral-800">{selectedUser.activity_count}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">管理操作</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleResetPassword(selectedUser.id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                  重置密码
                </button>
                <button
                  onClick={() => handleBanUser(selectedUser.id)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm"
                >
                  封禁用户
                </button>
                <button
                  onClick={() => handleUnbanUser(selectedUser.id)}
                  className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 text-sm"
                >
                  解除封禁
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                提示：封禁用户后该用户将无法登录系统
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
