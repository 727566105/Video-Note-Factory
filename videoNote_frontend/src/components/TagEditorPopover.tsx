import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X, Plus, Loader2 } from 'lucide-react'
import { updateNoteTags } from '@/services/note'
import { toast } from 'sonner'
import type { TaskTags } from '@/types/api'

interface Props {
  taskId: string
  tags: TaskTags | undefined
  onUpdate: (tags: TaskTags) => void
}

export function TagEditorPopover({ taskId, tags, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [platformTags, setPlatformTags] = useState<string[]>([])
  const [aiTags, setAiTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPlatformTags(tags?.platform_tags || [])
      setAiTags(tags?.ai_tags || [])
    }
  }, [open, tags])

  const handleAddTag = (type: 'platform' | 'ai') => {
    if (!newTag.trim()) return
    if (type === 'platform') {
      setPlatformTags([...platformTags, newTag.trim()])
    } else {
      setAiTags([...aiTags, newTag.trim()])
    }
    setNewTag('')
  }

  const handleRemoveTag = (type: 'platform' | 'ai', index: number) => {
    if (type === 'platform') {
      setPlatformTags(platformTags.filter((_, i) => i !== index))
    } else {
      setAiTags(aiTags.filter((_, i) => i !== index))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateNoteTags(taskId, { platform_tags: platformTags, ai_tags: aiTags })
      onUpdate({ platform_tags: platformTags, ai_tags: aiTags })
      toast.success('标签已保存')
      setOpen(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge variant="outline" className="cursor-pointer hover:bg-accent text-xs gap-1">
          <span className="text-[10px]">✏️</span>
          <span>编辑</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4">
        <div className="space-y-4">
          <div className="font-medium text-sm">编辑标签</div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">平台标签</div>
            <div className="flex gap-1 flex-wrap min-h-[28px]">
              {platformTags.map((tag, i) => (
                <Badge key={i} className="bg-blue-50 text-blue-600 border-blue-200 text-xs gap-1 pr-1">
                  {tag}
                  <X className="size-3 cursor-pointer hover:text-blue-800" onClick={() => handleRemoveTag('platform', i)} />
                </Badge>
              ))}
              {platformTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">AI 标签</div>
            <div className="flex gap-1 flex-wrap min-h-[28px]">
              {aiTags.map((tag, i) => (
                <Badge key={i} className="bg-purple-50 text-purple-600 border-purple-200 text-xs gap-1 pr-1">
                  {tag}
                  <X className="size-3 cursor-pointer hover:text-purple-800" onClick={() => handleRemoveTag('ai', i)} />
                </Badge>
              ))}
              {aiTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="输入新标签"
              className="h-8 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTag('ai')
              }}
            />
            <Button size="sm" variant="outline" className="h-8" onClick={() => handleAddTag('ai')}>
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}