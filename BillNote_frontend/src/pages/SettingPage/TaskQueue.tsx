import { useState, useEffect } from 'react'
import { getQueueStatus, updateQueueConfig } from '@/services/note'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import toast from 'react-hot-toast'
import { Settings, Minus, Plus } from 'lucide-react'

export default function TaskQueueSettings() {
  const [maxConcurrent, setMaxConcurrent] = useState(3)
  const [currentStatus, setCurrentStatus] = useState<{ running: number; max_concurrent: number; queued: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await getQueueStatus()
      if (res) {
        setCurrentStatus(res)
        setMaxConcurrent(res.max_concurrent)
      }
    } catch {
      // 忽略初始加载失败
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await updateQueueConfig(maxConcurrent)
      if (res) {
        setCurrentStatus(res)
        toast.success('并发配置已更新')
      }
    } catch {
      toast.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollArea className="h-full overflow-y-auto bg-white">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">任务队列配置</h1>
          <p className="text-sm text-muted-foreground mt-1">控制同时执行的任务数量，超出部分自动排队等待</p>
        </div>

        {/* 当前状态 */}
        {currentStatus && (
          <Card className="mb-6">
            <CardContent className="pt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">当前队列状态</h3>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{currentStatus.running}</div>
                  <div className="text-xs text-muted-foreground">执行中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{currentStatus.max_concurrent}</div>
                  <div className="text-xs text-muted-foreground">最大并发</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{currentStatus.queued}</div>
                  <div className="text-xs text-muted-foreground">排队中</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 并发配置 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4" />
              <h3 className="text-sm font-medium">最大并发任务数</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              设置同时执行的最大任务数量（1-10），超出部分将按 FIFO 顺序排队等待
            </p>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMaxConcurrent(prev => Math.max(1, prev - 1))}
                disabled={maxConcurrent <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex h-12 w-16 items-center justify-center rounded-md border-2 border-primary text-2xl font-bold">
                {maxConcurrent}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMaxConcurrent(prev => Math.min(10, prev + 1))}
                disabled={maxConcurrent >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={loading || maxConcurrent === currentStatus?.max_concurrent}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
