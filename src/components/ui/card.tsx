import { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>
}

export function CardHeader({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-4 py-3 border-b border-neutral-200 ${className}`}>{children}</div>
}

export function CardTitle({ className = '', children }: { className?: string; children: ReactNode }) {
  return <h2 className={`text-lg font-semibold text-neutral-800 ${className}`}>{children}</h2>
}

export function CardContent({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>
}

