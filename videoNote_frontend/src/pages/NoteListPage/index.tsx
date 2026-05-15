import { FC, useState } from 'react'
import {
  Plus,
  Download,
  RotateCw,
  Columns,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Square,
  FileText,
  Eye,
  Trash2,
  FolderPlus,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 表格数据类型
interface NoteItem {
  id: string
  cover: string
  platform: 'bilibili' | 'youtube' | 'douyin'
  title: string
  author: string
  note: string
  createdAt: string
}

const mockData: NoteItem[] = [
  {
    id: '1',
    cover: '',
    platform: 'bilibili',
    title: '【硬核科普】深度讲解AI原理',
    author: '科技前沿',
    note: '这是一篇关于AI原理的详细笔记...',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    cover: '',
    platform: 'youtube',
    title: 'React 19 新特性完全指南',
    author: 'Frontend Master',
    note: 'React 19带来了许多激动人心的新特性...',
    createdAt: '2024-01-14'
  }
]

export const NoteListPage: FC = () => {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const toggleSelectAll = () => {
    if (selectedRows.length === mockData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(mockData.map(item => item.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id))
    } else {
      setSelectedRows([...selectedRows, id])
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-4 p-6">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">总结记录</h1>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 标签行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md">
              表格
            </button>
            <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              卡片
            </button>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            新增
          </Button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <FolderPlus className="w-4 h-4" />
              添加到合集
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              批量导出
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">每页行数</span>
            <select className="px-2 py-1 text-sm border border-border rounded-md bg-background">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <select className="px-2 py-1 text-sm border border-border rounded-md bg-background">
                <option>1</option>
              </select>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Columns className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 提示行 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground font-medium">
            {selectedRows.length}/{mockData.length} 行被选中
          </span>
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-muted-foreground">提示：按住 Shift 键点击可连续选择</span>
        </div>

        {/* 表格容器 */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* 表头 */}
          <div className="flex items-center gap-4 px-4 py-3 bg-muted border-b border-border text-sm font-medium text-muted-foreground">
            <div className="w-5">
              <button
                onClick={toggleSelectAll}
                className={cn(
                  "w-4 h-4 border rounded flex items-center justify-center transition-colors",
                  selectedRows.length === mockData.length && mockData.length > 0
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                )}
              >
                {selectedRows.length === mockData.length && mockData.length > 0 && (
                  <Square className="w-3 h-3 fill-current" />
                )}
              </button>
            </div>
            <div className="w-32">封面</div>
            <div className="flex-1 min-w-0">标题</div>
            <div className="flex-1 min-w-0">笔记</div>
            <div className="w-24 text-right">操作菜单</div>
          </div>

          {/* 表格行 */}
          {mockData.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-accent hover:shadow-sm",
                selectedRows.includes(item.id) && "bg-accent"
              )}
            >
              <div className="w-5">
                <button
                  onClick={() => toggleSelectRow(item.id)}
                  className={cn(
                    "w-4 h-4 border rounded flex items-center justify-center transition-colors",
                    selectedRows.includes(item.id)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  )}
                >
                  {selectedRows.includes(item.id) && (
                    <Square className="w-3 h-3 fill-current" />
                  )}
                </button>
              </div>
              <div className="w-32">
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                  {item.cover ? (
                    <img src={item.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-xs text-muted-foreground">{item.platform}</div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.author}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground truncate">{item.note}</div>
              </div>
              <div className="w-24 flex items-center justify-end gap-2">
                <button className="p-1.5 hover:bg-accent rounded-md transition-colors">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 hover:bg-accent rounded-md transition-colors">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 hover:bg-accent rounded-md transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NoteListPage
