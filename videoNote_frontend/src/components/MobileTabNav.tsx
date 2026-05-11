import { FileText, History, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'form' | 'history' | 'preview'

interface MobileTabNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'form', label: '表单', icon: <FileText className="h-5 w-5" /> },
  { id: 'history', label: '历史', icon: <History className="h-5 w-5" /> },
  { id: 'preview', label: '预览', icon: <Eye className="h-5 w-5" /> },
]

const MobileTabNav = ({ activeTab, onTabChange }: MobileTabNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white md:hidden">
      <div className="flex h-14 items-center justify-around">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default MobileTabNav
export type { TabType }