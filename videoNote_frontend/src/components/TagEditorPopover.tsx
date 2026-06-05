import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X, Plus, Loader2, Pencil } from 'lucide-react'
import { updateNoteTags } from '@/services/note'
import { toast } from 'sonner'
import type { TaskTags } from '@/types/api'

interface Props {
  taskId: string
  tags: TaskTags | undefined
  onUpdate: (tags: TaskTags) => void
  hideTrigger?: boolean
}

export function TagEditorPopover({ taskId, tags, onUpdate, hideTrigger }: Props) {
  const [open, setOpen] = useState(false)
  const [platformTags, setPlatformTags] = useState<string[]>([])
  const [aiTags, setAiTags] = useState<string[]>([])
  const [manualTags, setManualTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPlatformTags(tags?.platform_tags || [])
      setAiTags(tags?.ai_tags || [])
      setManualTags(tags?.manual_tags || [])
    }
  }, [open, tags])

  const handleAddAndSave = async () => {
    if (!newTag.trim() || saving) return
    const tag = newTag.trim()
    if (manualTags.includes(tag)) return
    const updatedTags = [...manualTags, tag]
    setNewTag('')
    setSaving(true)
    try {
      await updateNoteTags(taskId, {
        platform_tags: platformTags,
        ai_tags: aiTags,
        manual_tags: updatedTags
      })
      setManualTags(updatedTags)
      onUpdate({ platform_tags: platformTags, ai_tags: aiTags, manual_tags: updatedTags })
      toast.success('标签已添加')
    } catch {
      toast.error('添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveTag = (type: 'platform' | 'ai' | 'manual', index: number) => {
    if (type === 'platform') {
      setPlatformTags(platformTags.filter((_, i) => i !== index))
    } else if (type === 'ai') {
      setAiTags(aiTags.filter((_, i) => i !== index))
    } else {
      setManualTags(manualTags.filter((_, i) => i !== index))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateNoteTags(taskId, {
        platform_tags: platformTags,
        ai_tags: aiTags,
        manual_tags: manualTags
      })
      onUpdate({ platform_tags: platformTags, ai_tags: aiTags, manual_tags: manualTags })
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
        <Badge variant="outline" className={`cursor-pointer gap-1 text-xs hover:bg-accent${hideTrigger ? ' sr-only' : ''}`}>
          <Pencil className="size-3" />
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
                <Badge key={i} className="gap-1 border-primary/20 bg-primary-light pr-1 text-xs text-primary">
                  {tag}
                  <X className="size-3 cursor-pointer hover:text-primary/75" style={{ pointerEvents: 'auto' }} onClick={() => handleRemoveTag('platform', i)} />
                </Badge>
              ))}
              {platformTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">AI 标签</div>
            <div className="flex gap-1 flex-wrap min-h-[28px]">
              {aiTags.map((tag, i) => (
                <Badge key={i} className="gap-1 border-border bg-secondary pr-1 text-xs text-secondary-foreground">
                  {tag}
                  <X className="size-3 cursor-pointer hover:text-foreground" style={{ pointerEvents: 'auto' }} onClick={() => handleRemoveTag('ai', i)} />
                </Badge>
              ))}
              {aiTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">手动标签</div>
            <div className="flex gap-1 flex-wrap min-h-[28px]">
              {manualTags.map((tag, i) => (
                <Badge key={i} className="gap-1 border-border bg-card pr-1 text-xs text-muted-foreground">
                  {tag}
                  <X className="size-3 cursor-pointer hover:text-foreground" style={{ pointerEvents: 'auto' }} onClick={() => handleRemoveTag('manual', i)} />
                </Badge>
              ))}
              {manualTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="输入新标签"
              className="h-8 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddAndSave()
              }}
            />
            <Button size="sm" variant="outline" className="h-8" onClick={handleAddAndSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span className="ml-1">添加</span>
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
