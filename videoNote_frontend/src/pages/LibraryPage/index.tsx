import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FolderOpen, MoreHorizontal, Pencil, Trash2,
  ListOrdered, FolderCog, Users, Bookmark, Search, Tag, LayoutGrid, RefreshCw, Heart, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty'
import { useCollectionStore } from '@/store/collectionStore'
import {
  getSmartCollections, createSmartCollection, syncSmartCollection, deleteSmartCollection,
  getPlazaCollections, toggleFavorite, getFavoriteCollections, cloneCollection,
  type SmartCollectionInfo, type CollectionInfo,
} from '@/services/collection'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function LibraryPage() {
  const navigate = useNavigate()
  const { collections, loading, fetchCollections, createCollection, deleteCollection } = useCollectionStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [smartSearch, setSmartSearch] = useState('')

  // 智能合集
  const [smartCollections, setSmartCollections] = useState<SmartCollectionInfo[]>([])
  const [smartCreateOpen, setSmartCreateOpen] = useState(false)
  const [smartName, setSmartName] = useState('')
  const [smartRuleType, setSmartRuleType] = useState('tag')
  const [smartRuleValue, setSmartRuleValue] = useState('')

  // 广场
  const [plazaItems, setPlazaItems] = useState<CollectionInfo[]>([])
  const [plazaLoading, setPlazaLoading] = useState(false)

  // 收藏
  const [favItems, setFavItems] = useState<CollectionInfo[]>([])

  useEffect(() => { fetchCollections() }, [])

  const fetchSmart = async () => {
    try { setSmartCollections(await getSmartCollections()) } catch {}
  }
  const fetchPlaza = async () => {
    setPlazaLoading(true)
    try { const d = await getPlazaCollections(); setPlazaItems(d.items || []) } catch {}
    finally { setPlazaLoading(false) }
  }
  const fetchFavs = async () => {
    try { setFavItems(await getFavoriteCollections()) } catch {}
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const created = await createCollection(newName.trim(), newDesc.trim() || undefined)
    if (created) {
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteCollection(id)
  }

  return (
    <div className="p-4 md:p-6 space-y-0">
      {/* 标题区 */}
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">合集管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">按 #标签 自动收录内容的智能合集。</p>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-[600px]">
          <TabsTrigger value="my"><ListOrdered className="mr-2 size-4" />我的合集</TabsTrigger>
          <TabsTrigger value="smart"><FolderCog className="mr-2 size-4" />智能合集</TabsTrigger>
          <TabsTrigger value="public"><Users className="mr-2 size-4" />合集广场</TabsTrigger>
          <TabsTrigger value="bookmarked"><Bookmark className="mr-2 size-4" />我的收藏</TabsTrigger>
        </TabsList>

        {/* ====== 我的合集 ====== */}
        <TabsContent value="my" className="mt-6">
          <MyCollectionsTab
            collections={collections}
            loading={loading}
            createOpen={createOpen}
            setCreateOpen={setCreateOpen}
            newName={newName}
            setNewName={setNewName}
            newDesc={newDesc}
            setNewDesc={setNewDesc}
            handleCreate={handleCreate}
            handleDelete={handleDelete}
            navigate={navigate}
          />
        </TabsContent>

        {/* ====== 智能合集 ====== */}
        <TabsContent value="smart" className="mt-6" onClick={fetchSmart}>
          <p className="mb-4 text-sm text-muted-foreground">
            通过标签、频道或平台自动归集笔记，省去手动整理。
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-2">
                <Search className="size-4 text-gray-500" />
                <Input value={smartSearch} onChange={e => setSmartSearch(e.target.value)} placeholder="搜索智能合集..." className="max-w-sm" />
              </div>
              <Dialog open={smartCreateOpen} onOpenChange={setSmartCreateOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 size-4" />创建智能合集</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>创建智能合集</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <Input value={smartName} onChange={e => setSmartName(e.target.value)} placeholder="合集名称（如：财经类）" />
                    <Select value={smartRuleType} onValueChange={setSmartRuleType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tag">按标签匹配</SelectItem>
                        <SelectItem value="platform">按平台匹配</SelectItem>
                        <SelectItem value="channel">按博主匹配</SelectItem>
                      </SelectContent>
                    </Select>
                    {smartRuleType === 'platform' ? (
                      <Select value={smartRuleValue} onValueChange={setSmartRuleValue}>
                        <SelectTrigger><SelectValue placeholder="选择平台" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bilibili">B站</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="douyin">抖音</SelectItem>
                          <SelectItem value="xiaohongshu">小红书</SelectItem>
                          <SelectItem value="kuaishou">快手</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={smartRuleValue} onChange={e => setSmartRuleValue(e.target.value)} placeholder={smartRuleType === 'tag' ? '标签名（如：AI）' : '博主 ID'} />
                    )}
                    <Button className="w-full" onClick={async () => {
                      if (!smartName.trim() || !smartRuleValue.trim()) { toast.error('请填写完整'); return }
                      try {
                        await createSmartCollection({ name: smartName.trim(), rule_type: smartRuleType, rule_value: smartRuleValue })
                        toast.success('智能合集已创建')
                        setSmartCreateOpen(false); setSmartName(''); setSmartRuleValue('')
                        fetchSmart()
                      } catch { toast.error('创建失败') }
                    }}>创建</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {smartCollections.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 px-6">
                <Tag className="mb-4 size-12 text-muted-foreground/40" />
                <h3 className="mb-2 text-lg font-semibold">暂无智能合集</h3>
                <p className="text-sm text-muted-foreground mb-4">创建后可自动按规则归集笔记</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {smartCollections.filter(s => !smartSearch || s.name.includes(smartSearch)).map(sc => (
                  <div key={sc.id} className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded bg-primary/10 flex items-center justify-center"><Tag className="size-4 text-primary" /></div>
                        <span className="font-medium">{sc.name}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={async () => { await syncSmartCollection(sc.id); toast.success('已同步'); fetchSmart() }}><RefreshCw className="mr-2 size-4" />同步</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500" onClick={async () => { await deleteSmartCollection(sc.id); toast.success('已删除'); fetchSmart() }}><Trash2 className="mr-2 size-4" />删除</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {sc.rule_type === 'tag' ? '标签' : sc.rule_type === 'platform' ? '平台' : '博主'}：{sc.rule_value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{sc.match_count} 条匹配</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ====== 合集广场 ====== */}
        <TabsContent value="public" className="mt-6" onClick={fetchPlaza}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">发现其他用户分享的精选合集</p>
            <Button variant="outline" size="sm" onClick={fetchPlaza} disabled={plazaLoading}>
              <RefreshCw className={cn("mr-2 size-4", plazaLoading && "animate-spin")} />刷新
            </Button>
          </div>
          {plazaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 px-6">
              <LayoutGrid className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="mb-2 text-lg font-semibold">暂无公开合集</h3>
              <p className="text-sm text-muted-foreground">分享你的合集到广场，让更多人看到</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plazaItems.map(item => (
                <div key={item.id} className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-muted">
                    {item.cover_url && <img src={item.cover_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium truncate cursor-pointer hover:text-primary" onClick={() => navigate(`/library/${item.id}`)}>{item.name}</h3>
                    {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.author_name}</span>
                      <span className="flex items-center gap-1"><Heart className="size-3" />{item.favorite_count || 0}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={async () => {
                        try { await toggleFavorite(item.id); toast.success('操作成功'); fetchPlaza() } catch { toast.error('操作失败') }
                      }}><Bookmark className="mr-1 size-3" />收藏</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={async () => {
                        try { await cloneCollection(item.id); toast.success('已克隆到我的合集'); fetchCollections() } catch { toast.error('克隆失败') }
                      }}><Copy className="mr-1 size-3" />克隆</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ====== 我的收藏 ====== */}
        <TabsContent value="bookmarked" className="mt-6" onClick={fetchFavs}>
          {favItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 px-6">
              <Bookmark className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="mb-2 text-lg font-semibold">暂无收藏</h3>
              <p className="text-sm text-muted-foreground">去广场收藏感兴趣的合集</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favItems.map(item => (
                <div key={item.id} className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/library/${item.id}`)}>
                  <h3 className="font-medium truncate">{item.name}</h3>
                  {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{item.item_count || 0} 条内容</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ====== 我的合集 Tab 内容 ====== */
function MyCollectionsTab({
  collections, loading, createOpen, setCreateOpen,
  newName, setNewName, newDesc, setNewDesc,
  handleCreate, handleDelete, navigate,
}: {
  collections: any[]
  loading: boolean
  createOpen: boolean
  setCreateOpen: (v: boolean) => void
  newName: string
  setNewName: (v: string) => void
  newDesc: string
  setNewDesc: (v: string) => void
  handleCreate: () => void
  handleDelete: (id: string, e: React.MouseEvent) => void
  navigate: (path: string) => void
}) {
  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 px-6">
        <FolderOpen className="mb-4 size-12 text-muted-foreground/40" />
        <h3 className="mb-2 text-lg font-semibold">暂无合集</h3>
        <p className="mb-4 text-center text-sm text-muted-foreground">
          创建合集，将相关笔记归类整理
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              创建合集
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建合集</DialogTitle>
            </DialogHeader>
            <CreateForm
              name={newName}
              desc={newDesc}
              onNameChange={setNewName}
              onDescChange={setNewDesc}
              onSubmit={handleCreate}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{collections.length} 个合集</span>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              创建合集
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建合集</DialogTitle>
            </DialogHeader>
            <CreateForm
              name={newName}
              desc={newDesc}
              onNameChange={setNewName}
              onDescChange={setNewDesc}
              onSubmit={handleCreate}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {collections.map(c => (
          <div
            key={c.id}
            onClick={() => navigate(`/library/${c.id}`)}
            className={cn(
              "group cursor-pointer rounded-xl border border-border bg-card overflow-hidden",
              "hover:shadow-md hover:border-primary/30 transition-all"
            )}
          >
            <div className="aspect-video bg-muted relative overflow-hidden">
              {c.cover_url ? (
                <img src={c.cover_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {c.item_count ?? 0} 个视频
              </div>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/40 text-white hover:bg-black/60">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/library/${c.id}`) }}>
                      <Pencil className="w-4 h-4 mr-2" />编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={e => handleDelete(c.id, e)}>
                      <Trash2 className="w-4 h-4 mr-2" />删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-medium text-sm truncate">{c.name}</h3>
              {c.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
              )}
              {c.category && (
                <span className="inline-block mt-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {c.category}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateForm({ name, desc, onNameChange, onDescChange, onSubmit }: {
  name: string
  desc: string
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="text-sm font-medium">合集名称 *</label>
        <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="输入合集名称" className="mt-1.5" onKeyDown={e => e.key === 'Enter' && onSubmit()} />
      </div>
      <div>
        <label className="text-sm font-medium">描述</label>
        <Input value={desc} onChange={e => onDescChange(e.target.value)} placeholder="可选" className="mt-1.5" />
      </div>
      <Button onClick={onSubmit} disabled={!name.trim()} className="w-full">创建</Button>
    </div>
  )
}

export default LibraryPage
