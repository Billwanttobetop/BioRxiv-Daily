import { ReactNode } from 'react'

type Variant = 'default' | 'secondary' | 'outline'

export function Badge({ variant = 'default', className = '', children }: { variant?: Variant; className?: string; children: ReactNode }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs'
  const variants: Record<Variant, string> = {
    default: 'bg-amber-500 text-white',
    secondary: 'bg-neutral-100 text-neutral-700',
    outline: 'border border-neutral-300 text-neutral-700',
  }
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>
}

