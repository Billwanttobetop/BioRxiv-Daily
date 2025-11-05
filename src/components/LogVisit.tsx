import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function LogVisit() {
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const log = async () => {
      try {
        await supabase.functions.invoke('log-visit', {
          body: {
            path: location.pathname,
            user_id: user?.id,
          },
        })
      } catch (error) {
        console.error('Error logging visit:', error)
      }
    }

    log()
  }, [location.pathname, user])

  return null
}