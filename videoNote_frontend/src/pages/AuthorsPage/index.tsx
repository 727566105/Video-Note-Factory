import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, PlayCircle } from 'lucide-react'
import { getAuthors, type AuthorInfo } from '@/services/author'
import { useIsMobile } from '@/hooks/use-mobile'

export function AuthorsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [authors, setAuthors] = useState<AuthorInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAuthors()
      .then((data) => setAuthors(data?.authors || []))
      .catch(() => setAuthors([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (authors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Users className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground">暂无博主数据，生成笔记后会自动收录</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 max-w-4xl mx-auto">
      {/* 桌面端显示标题 */}
      {!isMobile && (
        <h1 className="text-xl md:text-2xl font-bold mb-6">博主列表</h1>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {authors.map((author) => (
          <button
            key={author.author_id}
            onClick={() => navigate(`/authors/${author.author_id}`)}
            className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors text-left"
          >
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="size-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{author.author_name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <PlayCircle className="size-3.5" />
                {author.video_count} 个视频
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default AuthorsPage