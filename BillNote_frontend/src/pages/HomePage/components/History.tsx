import NoteHistory from '@/pages/HomePage/components/NoteHistory.tsx'
import { useTaskStore } from '@/store/taskStore'

const History = () => {
  const currentTaskId = useTaskStore(state => state.currentTaskId)
  const setCurrentTask = useTaskStore(state => state.setCurrentTask)
  return (
    <div className="flex h-full w-full flex-col">
      {/* 历史记录列表 */}
      <div className="flex-1 overflow-y-auto px-2.5">
        <NoteHistory onSelect={setCurrentTask} selectedId={currentTaskId} />
      </div>
    </div>
  )
}

export default History