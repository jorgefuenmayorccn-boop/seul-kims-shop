import { CerebroSidebar } from '@/components/layout/cerebro-sidebar'

export default function CerebroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CerebroSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
