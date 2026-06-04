import { useEffect, useState } from 'react'
import { Plus, FolderOpen, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCollectionStore } from '@/store/collectionStore'
import { cn } from '@/lib/utils'

interface AddToCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskIds: string[]
  onSuccess?: () => void
}

export function AddToCollectionDialog({ open, onOpenChange, taskIds, onSuccess }: AddToCollectionDialogProps) {
  const { collections, fetchCollections, createCollection, addItems } = useCollectionStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)

  useEffect(() => {
    if (open) fetchCollections()
  }, [open])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await createCollection(newName.trim(), undefined, undefined, taskIds)
      if (created) {
        setNewName('')
        onSuccess?.()
        onOpenChange(false)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleAddTo = async (collectionId: string) => {
    setAddingTo(collectionId)
    try {
      const added = await addItems(collectionId, taskIds)
      if (added > 0) {
        onSuccess?.()
      }
      onOpenChange(false)
    } finally {
      setAddingTo(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>添加到合集</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* 创建新合集 */}
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="新建合集名称"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="h-9"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* 已有合集列表 */}
          {collections.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {collections.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleAddTo(c.id)}
                  disabled={addingTo !== null}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
                    "hover:bg-accent transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    {c.cover_url ? (
                      <img src={c.cover_url} alt="" className="w-full h-full object-cover rounded" />
                    ) : (
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{(c as any).item_count ?? 0} 个视频</p>
                  </div>
                  {addingTo === c.id && (
                    <LoaderCircle className="w-4 h-4 animate-spin shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
