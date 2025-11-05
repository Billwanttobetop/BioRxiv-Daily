import { useEffect, useState } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SettingItem {
  key: string
  value: string
  label: string
  description: string
  type: 'text' | 'textarea' | 'url'
}

const settingFields: SettingItem[] = [
  {
    key: 'ai_api_key',
    value: '',
    label: 'AI API Key',
    description: '用于调用AI服务的API密钥',
    type: 'text'
  },
  {
    key: 'ai_base_url',
    value: '',
    label: 'AI Base URL',
    description: 'AI服务的Base URL，例如 https://api.openai.com/v1',
    type: 'url'
  },
  {
    key: 'copyright',
    value: '',
    label: '版权声明',
    description: '网站底部显示的版权信息',
    type: 'text'
  },
  {
    key: 'contact_email',
    value: '',
    label: '联系邮箱',
    description: '公开的联系邮箱地址',
    type: 'text'
  },
  {
    key: 'contact_phone',
    value: '',
    label: '联系电话',
    description: '公开的联系电话号码',
    type: 'text'
  },
  {
    key: 'address',
    value: '',
    label: '公司地址',
    description: '公司或组织的地址信息',
    type: 'textarea'
  },
  {
    key: 'social_twitter',
    value: '',
    label: 'Twitter 链接',
    description: 'Twitter 社交媒体主页链接',
    type: 'url'
  },
  {
    key: 'social_github',
    value: '',
    label: 'GitHub 链接',
    description: 'GitHub 组织或账号链接',
    type: 'url'
  }
]

export function SiteSettingsView() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value')

      if (error) throw error

      if (data) {
        const settingsMap: Record<string, string> = {}
        data.forEach((item) => {
          settingsMap[item.setting_key] = item.setting_value || ''
        })
        setSettings(settingsMap)
      }
    } catch (error) {
      console.error('鑾峰彇绔欑偣璁剧疆澶辫触:', error)
      setMessage({ type: 'error', text: '鑾峰彇绔欑偣璁剧疆澶辫触' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      // 鏇存柊姣忎釜璁剧疆椤?
      for (const field of settingFields) {
        const { error } = await supabase
          .from('site_settings')
          .update({ 
            setting_value: settings[field.key] || '',
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', field.key)

        if (error) throw error
      }

      setMessage({ type: 'success', text: '璁剧疆淇濆瓨鎴愬姛' })
      
      // 3绉掑悗娓呴櫎娑堟伅
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('淇濆瓨璁剧疆澶辫触:', error)
      setMessage({ type: 'error', text: '淇濆瓨璁剧疆澶辫触锛岃閲嶈瘯' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 澶撮儴 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">绔欑偣璁剧疆</h2>
          <p className="text-neutral-600 mt-1">绠＄悊缃戠珯鐗堟潈淇℃伅鍜岃仈绯绘柟寮?/p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? '淇濆瓨涓?..' : '淇濆瓨璁剧疆'}
        </button>
      </div>

      {/* 娑堟伅鎻愮ず */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 璁剧疆琛ㄥ崟 */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="space-y-6">
          {settingFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {field.label}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{field.description}</p>
              
              {field.type === 'textarea' ? (
                <textarea
                  value={settings[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder={`璇疯緭鍏?{field.label}`}
                />
              ) : (
                <input
                  type={field.type === 'url' ? 'url' : 'text'}
                  value={settings[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder={`璇疯緭鍏?{field.label}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 棰勮鍖哄煙 */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">椤佃剼棰勮</h3>
        <div className="bg-neutral-800 text-neutral-300 p-8 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 鍏充簬鎴戜滑 */}
            <div>
              <h4 className="text-white text-base font-semibold mb-3">鍏充簬鎴戜滑</h4>
              <p className="text-sm">
                BioRxiv鏃ユ姤鑷村姏浜庝负鐢熺墿鍖诲鐮旂┒鑰呮彁渚涙渶鏂般€佹渶鍓嶆部鐨勯鍗版湰璁烘枃璧勮銆?
              </p>
            </div>

            {/* 鑱旂郴鏂瑰紡 */}
            <div>
              <h4 className="text-white text-base font-semibold mb-3">鑱旂郴鏂瑰紡</h4>
              <div className="space-y-2 text-sm">
                {settings.contact_email && <div>閭: {settings.contact_email}</div>}
                {settings.contact_phone && <div>鐢佃瘽: {settings.contact_phone}</div>}
                {settings.address && <div>鍦板潃: {settings.address}</div>}
              </div>
            </div>

            {/* 绀句氦濯掍綋 */}
            <div>
              <h4 className="text-white text-base font-semibold mb-3">鍏虫敞鎴戜滑</h4>
              <div className="text-sm space-y-1">
                {settings.social_twitter && <div>Twitter: {settings.social_twitter}</div>}
                {settings.social_github && <div>GitHub: {settings.social_github}</div>}
              </div>
            </div>
          </div>

          {/* 鐗堟潈澹版槑 */}
          <div className="mt-6 pt-6 border-t border-neutral-700">
            <p className="text-xs text-center text-neutral-400">
              {settings.copyright || '鏆傛棤鐗堟潈澹版槑'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

