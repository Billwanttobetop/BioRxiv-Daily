import { Link } from 'react-router-dom'
import { BookOpen, User, Heart, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { user, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminStatus()
  }, [user])

  async function checkAdminStatus() {
    if (!user) {
      setIsAdmin(false)
      return
    }

    try {
      const { data: authData } = await supabase.auth.getSession()
      if (!authData.session) {
        setIsAdmin(false)
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
    }
  }

  return (
    <nav className="bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-neutral-800">
            <BookOpen className="w-6 h-6 text-amber-600" />
            <span>BioRxiv日报</span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-6">
            <Link 
              to="/" 
              className="text-neutral-700 hover:text-amber-600 transition-colors"
            >
              首页
            </Link>
            
            {user ? (
              <>
                <Link 
                  to="/favorites" 
                  className="flex items-center gap-1 text-neutral-700 hover:text-amber-600 transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  <span>收藏</span>
                </Link>
                

                
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className="flex items-center gap-1 text-neutral-700 hover:text-amber-600 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>管理</span>
                  </Link>
                )}

                <div className="flex items-center gap-3 pl-3 border-l border-neutral-200">
                  <Link 
                    to="/profile" 
                    className="flex items-center gap-1 text-neutral-700 hover:text-amber-600 transition-colors"
                  >
                    <User className="w-4 h-4" />
                  </Link>
                  
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 text-neutral-700 hover:text-rose-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link 
                to="/login" 
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
