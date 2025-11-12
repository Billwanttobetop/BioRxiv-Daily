import { SpeedInsights } from '@vercel/speed-insights/react'
import { useLocation } from 'react-router-dom'

export function Insights() {
  const location = useLocation()
  return <SpeedInsights route={location.pathname} />
}