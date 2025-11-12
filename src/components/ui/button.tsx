import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'outline'
type Size = 'sm' | 'md'

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  const base = 'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
  }
  const variants: Record<Variant, string> = {
    default: 'bg-amber-500 text-white hover:bg-amber-600',
    outline: 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

