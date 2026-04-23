import { useEffect, useRef, useState, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PLATFORM_LABEL_MAP: Record<string, string> = {
  bilibili: 'B站',
  douyin: '抖音',
  local: '本地视频',
  local_audio: '本地音频',
  kuaishou: '快手',
  youtube: 'YouTube',
}

interface ExportImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  title: string
  coverUrl?: string
  platform?: string
  modelName?: string
  createdAt?: string
}

const ExportImageDialog = ({
  open,
  onOpenChange,
  content,
  title,
  coverUrl,
  platform = 'bilibili',
  modelName = '未知模型',
  createdAt,
}: ExportImageDialogProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const platformLabel = PLATFORM_LABEL_MAP[platform] || platform

  const formatDate = (date: string | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // 构建 iframe 内容 HTML
  const buildHTML = useCallback(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #fff;
    color: #333;
  }
  .cover { width: 750px; height: 260px; overflow: hidden; border-radius: 12px 12px 0 0; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .content { padding: 24px 32px; }
  .content.no-cover { padding-top: 24px; }
  .title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; line-height: 1.4; }
  .meta { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; font-size: 14px; color: #666; }
  .meta .tag { padding: 2px 8px; background: #f0f0f0; border-radius: 4px; font-size: 13px; }
  .divider { height: 1px; background: #e5e5e5; margin-bottom: 20px; }
  .markdown { font-size: 15px; line-height: 1.8; color: #333; word-break: break-word; }
  .markdown h1 { font-size: 22px; font-weight: 700; margin: 24px 0 12px; color: #1a1a1a; }
  .markdown h2 { font-size: 19px; font-weight: 700; margin: 20px 0 10px; color: #1a1a1a; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  .markdown h3 { font-size: 17px; font-weight: 600; margin: 16px 0 8px; color: #1a1a1a; }
  .markdown h4 { font-size: 15px; font-weight: 600; margin: 12px 0 6px; color: #333; }
  .markdown p { margin: 10px 0; }
  .markdown a { color: #4a90d9; text-decoration: none; }
  .markdown strong { font-weight: 700; color: #1a1a1a; }
  .markdown ul { margin: 8px 0 8px 20px; list-style: disc; }
  .markdown ol { margin: 8px 0 8px 20px; list-style: decimal; }
  .markdown li { margin: 4px 0; }
  .markdown blockquote { border-left: 3px solid #ddd; padding-left: 12px; margin: 12px 0; color: #666; font-style: italic; }
  .markdown code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 13px; font-family: monospace; }
  .markdown pre { background: #f6f8fa; padding: 12px; border-radius: 6px; margin: 10px 0; overflow: hidden; }
  .markdown pre code { background: transparent; padding: 0; }
  .markdown table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  .markdown th, .markdown td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .markdown th { font-weight: 600; background: #f9f9f9; }
  .markdown hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
  .markdown img { max-width: 100%; border-radius: 6px; margin: 12px 0; display: block; }
  .watermark { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 13px; }
</style>
</head>
<body>
  ${coverUrl ? `<div class="cover"><img src="${coverUrl}" crossorigin="anonymous" /></div>` : ''}
  <div class="content${coverUrl ? '' : ' no-cover'}">
    <div class="title">${title}</div>
    <div class="meta">
      <span>${platformLabel}</span>
      <span class="tag">${modelName}</span>
      ${createdAt ? `<span>${formatDate(createdAt)}</span>` : ''}
    </div>
    <div class="divider"></div>
    <div class="markdown" id="md-content"></div>
    <div class="watermark">videoNote · AI视频笔记神器</div>
  </div>
  <script>
    document.getElementById('md-content').innerHTML = marked.parse(decodeURIComponent("${encodeURIComponent(content)}"));
  <\/script>
</body>
</html>`
  }, [content, title, coverUrl, platform, modelName, createdAt, platformLabel])

  // 生成图片
  useEffect(() => {
    if (!open) {
      setImageUrl(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setImageUrl(null)

    const iframe = iframeRef.current
    if (!iframe) {
      setError('iframe 未就绪')
      setLoading(false)
      return
    }

    // 写入 iframe 内容
    iframe.srcdoc = buildHTML()

    const onLoad = async () => {
      try {
        const iframeDoc = iframe.contentDocument
        if (!iframeDoc || !iframeDoc.body) {
          throw new Error('iframe 内容未加载')
        }

        // 等待图片加载
        await new Promise(resolve => setTimeout(resolve, 1000))

        const canvas = await html2canvas(iframeDoc.body, {
          width: 750,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 750,
        })

        const url = canvas.toDataURL('image/png', 1.0)
        setImageUrl(url)
      } catch (err) {
        console.error('生成图片失败:', err)
        setError(err instanceof Error ? err.message : '生成图片失败')
      } finally {
        setLoading(false)
      }
    }

    iframe.addEventListener('load', onLoad)
    return () => {
      iframe.removeEventListener('load', onLoad)
    }
  }, [open, buildHTML])

  // 下载图片
  const handleDownload = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `${title || '笔记'}_${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      {/* 隐藏的 iframe 用于隔离渲染 */}
      <iframe
        ref={iframeRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '750px',
          height: '100px',
          visibility: 'hidden',
          zIndex: -1,
          border: 'none',
        }}
        sandbox="allow-same-origin allow-scripts"
        title="export-render"
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导出图文预览</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {loading && (
              <div className="flex items-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">正在生成图片...</span>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm py-4">{error}</div>
            )}

            {imageUrl && (
              <img
                src={imageUrl}
                alt="导出预览"
                className="max-w-full rounded-lg border shadow-sm"
                style={{ maxHeight: '60vh' }}
              />
            )}

            <Button onClick={handleDownload} disabled={!imageUrl || loading} className="gap-2">
              <Download className="h-4 w-4" />
              下载图片
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ExportImageDialog