import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Config {
  id: string
  key: string
  value: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function SystemConfigsView() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [editingConfig, setEditingConfig] = useState<Config | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    description: '',
    isActive: true
  })

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase.functions.invoke('admin-get-configs', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (!error && data?.data?.configs) {
        setConfigs(data.data.configs)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase.functions.invoke('admin-update-config', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          configId: editingConfig?.id,
          key: formData.key,
          value: formData.value,
          description: formData.description,
          isActive: formData.isActive
        }
      })

      if (!error) {
        setEditingConfig(null)
        setShowAddModal(false)
        setFormData({ key: '', value: '', description: '', isActive: true })
        loadConfigs()
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('保存失败，请重试')
    }
  }

  const handleEdit = (config: Config) => {
    setEditingConfig(config)
    setFormData({
      key: config.key,
      value: config.value,
      description: config.description,
      isActive: config.is_active
    })
  }

  const handleDelete = async (configId: string) => {
    if (!confirm('确定要删除此配置吗？')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase.functions.invoke('admin-delete-config', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { configId }
      })

      if (!error) {
        loadConfigs()
      }
    } catch (error) {
      console.error('Failed to delete config:', error)
      alert('删除失败，请重试')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-neutral-800">系统配置管理</h3>
            <p className="text-sm text-neutral-600 mt-1">管理API密钥、系统参数等配置</p>
          </div>
          <button
            onClick={() => {
              setShowAddModal(true)
              setFormData({ key: '', value: '', description: '', isActive: true })
            }}
            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
          >
            添加配置
          </button>
        </div>
      </div>

      {/* Configs List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  配置键
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  配置值
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  描述
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  更新时间
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
              ) : configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-neutral-500">
                    暂无配置
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {config.key}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      <span className="inline-block max-w-xs truncate">
                        {config.key.toLowerCase().includes('key') || config.key.toLowerCase().includes('secret')
                          ? '••••••••'
                          : config.value}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {config.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        config.is_active 
                          ? 'text-amber-600 bg-amber-100' 
                          : 'text-red-600 bg-red-100'
                      }`}>
                        {config.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {formatDate(config.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(config)}
                        className="text-amber-600 hover:text-amber-900"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {(editingConfig || showAddModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-neutral-800">
                {editingConfig ? '编辑配置' : '添加配置'}
              </h3>
              <button
                onClick={() => {
                  setEditingConfig(null)
                  setShowAddModal(false)
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  配置键
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingConfig}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-neutral-100"
                  placeholder="例如: MINIMAX_API_KEY"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  配置值
                </label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="输入配置值"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="配置说明"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 border-neutral-300 rounded focus:ring-amber-500"
                />
                <label className="ml-2 text-sm text-neutral-700">
                  启用此配置
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setEditingConfig(null)
                    setShowAddModal(false)
                  }}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
