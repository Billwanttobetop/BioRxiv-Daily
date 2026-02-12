import { ReactNode } from 'react'

export function ScrollArea({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`overflow-auto rounded-md border border-neutral-200 ${className}`}>{children}</div>
}

