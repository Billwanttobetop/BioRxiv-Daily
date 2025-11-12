import { useEffect, useState } from 'react'
import { Mail, Phone, MapPin, Twitter, Github } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SiteSettings {
  copyright: string
  contact_email: string
  contact_phone: string
  social_twitter: string
  social_github: string
  address: string
}

export function Footer() {
  const [settings, setSettings] = useState<SiteSettings>({
    copyright: '',
    contact_email: '',
    contact_phone: '',
    social_twitter: '',
    social_github: '',
    address: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value')

      if (error) throw error

      if (data) {
        const settingsMap: any = {}
        data.forEach((item) => {
          settingsMap[item.setting_key] = item.setting_value
        })
        setSettings(settingsMap)
      }
    } catch (error) {
      console.error('获取站点设置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  return (
    <footer className="bg-neutral-800 text-neutral-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 关于我们 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">关于我们</h3>
            <p className="text-sm leading-relaxed">
              BioRxiv日报致力于为生物医学研究者提供最新、最前沿的预印本论文资讯，帮助科研工作者快速掌握领域动态。
            </p>
          </div>

          {/* 联系方式 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">联系方式</h3>
            <div className="space-y-3">
              {settings.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <a href={`mailto:${settings.contact_email}`} className="hover:text-amber-500 transition-colors">
                    {settings.contact_email}
                  </a>
                </div>
              )}
              
              {settings.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-amber-500" />
                  <span>{settings.contact_phone}</span>
                </div>
              )}
              
              {settings.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-amber-500 mt-0.5" />
                  <span>{settings.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* 社交媒体 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">关注我们</h3>
            <div className="flex gap-4">
              {settings.social_twitter && (
                <a 
                  href={settings.social_twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              
              {settings.social_github && (
                <a 
                  href={settings.social_github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 版权声明 */}
        <div className="mt-8 pt-8 border-t border-neutral-700">
          <p className="text-sm text-center text-neutral-400">
            {settings.copyright}
          </p>
        </div>
      </div>
    </footer>
  )
}
