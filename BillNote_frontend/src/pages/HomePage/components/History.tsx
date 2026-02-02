import NoteHistory from '@/pages/HomePage/components/NoteHistory.tsx'
import { useTaskStore } from '@/store/taskStore'
import { Info, Clock, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
const History = () => {
  const currentTaskId = useTaskStore(state => state.currentTaskId)
  const setCurrentTask = useTaskStore(state => state.setCurrentTask)
  return (
    <div className="flex h-full w-full flex-col">
      {/* 生成历史标题 */}
      <div className="flex h-[56px] shrink-0 items-center gap-2 px-3 py-2 md:px-4 md:py-3">
        <Clock className="h-4 w-4 text-neutral-500" />
        <h2 className="text-base font-medium text-neutral-900">生成历史</h2>
      </div>
      {/* 历史记录列表 - 使用flex-1和overflow-y-auto实现滚动 */}
      <div className="flex-1 overflow-y-auto px-2.5">
        <NoteHistory onSelect={setCurrentTask} selectedId={currentTaskId} />
      </div>
    </div>
  )
}

export default History
