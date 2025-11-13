import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function LogVisit() {
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const noop = async () => {}
    noop()
  }, [location.pathname, user])

  return null
}
