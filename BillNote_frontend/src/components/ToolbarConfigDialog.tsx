import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useSystemStore } from '@/store/configStore'
import type { ToolbarConfig } from '@/types/api'
import { TOOLBAR_BUTTON_LIST, DEFAULT_TOOLBAR_CONFIG } from '@/types/api'

interface ToolbarConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToolbarConfigDialog({ open, onOpenChange }: ToolbarConfigDialogProps) {
  const toolbarConfig = useSystemStore(state => state.toolbarConfig)
  const setToolbarConfig = useSystemStore(state => state.setToolbarConfig)

  const [external, setExternal] = useState<string[]>([])
  const [menu, setMenu] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setExternal(toolbarConfig.externalButtons)
      setMenu(toolbarConfig.menuButtons)
    }
  }, [open, toolbarConfig])

  const moveToMenu = (id: string) => {
    setExternal(prev => prev.filter(b => b !== id))
    setMenu(prev => [...prev, id])
  }

  const moveToExternal = (id: string) => {
    setMenu(prev => prev.filter(b => b !== id))
    setExternal(prev => [...prev, id])
  }

  const handleSave = () => {
    setToolbarConfig({ externalButtons: external, menuButtons: menu })
    onOpenChange(false)
  }

  const handleReset = () => {
    setExternal([...DEFAULT_TOOLBAR_CONFIG.externalButtons])
    setMenu([])
  }

  const getLabel = (id: string) =>
    TOOLBAR_BUTTON_LIST.find(b => b.id === id)?.label || id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>工具栏设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 工具栏按钮 */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              工具栏按钮（取消勾选移至更多菜单）
            </p>
            <div className="flex flex-wrap gap-2">
              {external.length > 0 ? (
                external.map(id => (
                  <label
                    key={id}
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => moveToMenu(id)}
                    />
                    {getLabel(id)}
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-400">暂无按钮</p>
              )}
            </div>
          </div>

          {/* 更多菜单 */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              更多菜单（勾选移至工具栏）
            </p>
            <div className="flex flex-wrap gap-2">
              {menu.length > 0 ? (
                menu.map(id => (
                  <label
                    key={id}
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => moveToExternal(id)}
                    />
                    {getLabel(id)}
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-400">暂无按钮</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
