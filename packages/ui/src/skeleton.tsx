import { cn } from './lib/utils'

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-[var(--ink-100)] rounded-md', className)} />
  )
}

export function SkeletonKPICard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-elevated rounded-lg p-5 border border-[var(--color-border)] shadow-sm space-y-3', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)]', className)}>
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-20 ml-auto" />
      <Skeleton className="h-5 w-16" />
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonKPICard key={i} />)}
      </div>
      <div className="bg-elevated rounded-lg border border-[var(--color-border)]">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
