import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plug,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Terminal,
  FileCode,
  MousePointerClick,
  Video,
  Search,
  Download,
  Rss,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import request from '@/utils/request'

function ConfigBlock({ text, onCopy }: { text: string; onCopy: (text: string) => void }) {
  return (
    <pre className="relative rounded-lg border bg-muted/50 p-4 text-sm">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7"
        onClick={() => onCopy(text)}
      >
        <Copy className="size-3.5" />
      </Button>
      <code className="text-xs whitespace-pre-wrap break-all">{text}</code>
    </pre>
  )
}

// 步骤序号圆圈
function StepNum({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {n}
    </span>
  )
}

// 可用能力数据
const TOOL_GROUPS = [
  {
    icon: <Video className="size-4" />,
    title: '视频笔记',
    tools: [
      { name: 'import_video', desc: '丢一个视频链接，自动下载转写生成笔记' },
      { name: 'get_task_status', desc: '查询笔记生成进度和结果' },
      { name: 'list_notes', desc: '列出历史笔记' },
      { name: 'view_note', desc: '查看笔记完整内容' },
      { name: 'cancel_task', desc: '取消正在进行的任务' },
      { name: 'delete_task', desc: '删除笔记' },
    ],
  },
  {
    icon: <Download className="size-4" />,
    title: '笔记导出',
    tools: [{ name: 'export_note', desc: '导出笔记为 PDF / HTML / DOCX' }],
  },
  {
    icon: <Rss className="size-4" />,
    title: '订阅与动态',
    tools: [
      { name: 'list_subscriptions', desc: '查看已订阅频道' },
      { name: 'add_subscription', desc: '订阅新频道' },
      { name: 'refresh_subscription', desc: '拉取频道最新视频' },
      { name: 'get_feed', desc: '获取订阅动态 Feed' },
      { name: 'refresh_feed', desc: '刷新所有订阅' },
      { name: 'generate_from_feed', desc: '为图文动态生成笔记' },
    ],
  },
  {
    icon: <Layers className="size-4" />,
    title: '频道与合集',
    tools: [
      { name: 'list_channel_videos', desc: '列出频道视频' },
      { name: 'list_author_videos', desc: '列出博主视频' },
      { name: 'list_collections', desc: '列出笔记合集' },
      { name: 'generate_summary', desc: 'AI 生成合集总结' },
    ],
  },
]

// 使用示例
const USAGE_EXAMPLES = [
  {
    user: '导入视频',
    ai: '帮我记一下这个视频 https://www.bilibili.com/video/BV1xx...',
    result: '→ 调用 import_video，后台自动下载转写',
  },
  {
    user: '查进度',
    ai: '刚才那个视频笔记好了吗？',
    result: '→ 调用 get_task_status，返回生成状态和笔记内容',
  },
  {
    user: '看笔记',
    ai: '我之前做的笔记有哪些？',
    result: '→ 调用 list_notes，列出所有历史笔记',
  },
  {
    user: '订阅刷新',
    ai: '看看我订阅的频道有没有新视频',
    result: '→ 调用 refresh_feed，再调 get_feed 获取最新动态',
  },
]

export default function McpSettings() {
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // 生成时拿到的明文 key（用于配置 JSON 展示），刷新页面后丢失
  const [plainKey, setPlainKey] = useState<string | null>(null)

  const fetchApiKey = useCallback(async () => {
    try {
      const data = (await request.get('/auth/api-key')) as {
        exists: boolean
        masked: string | null
      }
      setMaskedKey(data.masked)
      setExists(data.exists)
    } catch {
      // 静默处理
    }
  }, [])

  useEffect(() => {
    fetchApiKey()
  }, [fetchApiKey])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const data = (await request.post('/auth/api-key/generate')) as { api_key: string }
      setNewKey(data.api_key)
      setPlainKey(data.api_key)
      setRegenerateOpen(true)
      await fetchApiKey()
    } catch {
      // toast 由拦截器处理
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  // MCP Server 地址：
  // - Docker/nginx 部署：走同源 /mcp（nginx 反代，支持 SSE 长连接）
  // - 本地 pnpm dev：Vite proxy 对 SSE GET 长连接支持不完整，需直连后端端口
  const [mcpUrl, setMcpUrl] = useState(`${window.location.origin}/mcp`)
  useEffect(() => {
    const backendPort = (import.meta as any).env?.VITE_MCP_BACKEND_PORT
    if (backendPort) {
      setMcpUrl(`http://${window.location.hostname}:${backendPort}/mcp`)
      return
    }
    if (window.location.port === '3015' || window.location.port === '5173') {
      setMcpUrl(`http://${window.location.hostname}:8483/mcp`)
    }
  }, [])

  // 配置 JSON 中用明文 key（如果有的话），否则用占位符
  const bearerKey = plainKey || 'vn_你的API_Key'

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        {/* 页头 */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Plug className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">MCP 接入指南</h1>
            <p className="text-sm text-muted-foreground">
              让 AI 客户端（Claude / Cursor / 小龙虾等）连接 VideoNote，通过对话导入视频、生成笔记
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* 第一步：获取 API Key */}
        {/* ════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StepNum n={1} />
              获取你的 API Key
              {exists && <Badge variant="secondary">已启用</Badge>}
            </CardTitle>
            <CardDescription>
              API Key 是你的 MCP 专属凭证，每个用户独立，用于 AI 客户端连接时鉴权
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exists ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>当前 API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input value={maskedKey || ''} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(plainKey || maskedKey || '')}
                      title="复制"
                      disabled={!plainKey && !maskedKey}
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    出于安全考虑，API Key 仅在生成时显示一次完整内容。
                    {plainKey
                      ? '当前页面已缓存明文，可直接复制用于配置。'
                      : '如需完整 Key，请点击下方「重置 API Key」。'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                  重置 API Key
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  还没有 API Key，点击下方按钮生成一个。生成后请妥善保存（仅显示一次）。
                </p>
                <Button onClick={handleGenerate} disabled={loading} className="gap-2">
                  <Plug className="size-4" />
                  {loading ? '生成中...' : '生成 API Key'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════ */}
        {/* 第二步：接入你的 AI 客户端 */}
        {/* ════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StepNum n={2} />
              接入你的 AI 客户端
            </CardTitle>
            <CardDescription>
              选择你使用的 AI 工具，按步骤操作即可完成连接
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 连接信息摘要 */}
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">MCP Server 地址</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono">
                    {mcpUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleCopy(mcpUrl)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">你的 API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono">
                    {plainKey || maskedKey || '未生成'}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleCopy(plainKey || maskedKey || '')}
                    disabled={!plainKey && !maskedKey}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            {(window.location.port === '3015' || window.location.port === '5173') && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
                <span>
                  本地开发模式下 MCP 地址使用后端直连端口（8483），因为 Vite 开发服务器对 MCP
                  的 SSE 长连接代理不完整。Docker 部署后地址会自动变为同源 /mcp。
                </span>
              </div>
            )}

            <Separator />

            <Tabs defaultValue="cursor">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                <TabsTrigger value="cursor" className="gap-1.5">
                  <MousePointerClick className="size-3.5" /> Cursor / Windsurf
                </TabsTrigger>
                <TabsTrigger value="claude-code" className="gap-1.5">
                  <Terminal className="size-3.5" /> Claude Code
                </TabsTrigger>
                <TabsTrigger value="claude-desktop" className="gap-1.5">
                  <BookOpen className="size-3.5" /> Claude Desktop
                </TabsTrigger>
                <TabsTrigger value="vscode" className="gap-1.5">
                  <FileCode className="size-3.5" /> VS Code
                </TabsTrigger>
                <TabsTrigger value="generic" className="gap-1.5">
                  <Plug className="size-3.5" /> 其他平台
                </TabsTrigger>
              </TabsList>

              {/* ─── Cursor / Windsurf ─── */}
              <TabsContent value="cursor" className="space-y-3 pt-2">
                <div className="flex gap-2 text-sm">
                  <StepNum n={1} />
                  <p className="pt-0.5 text-muted-foreground">
                    在项目根目录创建配置文件：
                    <br />
                    <strong>Cursor</strong>：{`>`}{' '}
                    <code className="rounded bg-muted px-1 text-xs">.cursor/mcp.json</code>
                    <br />
                    <strong>Windsurf</strong>：{`>`}{' '}
                    <code className="rounded bg-muted px-1 text-xs">.codeium/mcp.json</code>
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <StepNum n={2} />
                  <p className="pt-0.5 text-muted-foreground">填入以下内容：</p>
                </div>
                <ConfigBlock
                  text={`{
  "mcpServers": {
    "videonote": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${bearerKey}"
      }
    }
  }
}`}
                  onCopy={handleCopy}
                />
                <div className="flex gap-2 text-sm">
                  <StepNum n={3} />
                  <p className="pt-0.5 text-muted-foreground">
                    保存文件后重启 Cursor / Windsurf，在 AI 对话中即可使用 VideoNote 的工具
                  </p>
                </div>
              </TabsContent>

              {/* ─── Claude Code ─── */}
              <TabsContent value="claude-code" className="space-y-3 pt-2">
                <div className="flex gap-2 text-sm">
                  <StepNum n={1} />
                  <p className="pt-0.5 text-muted-foreground">
                    打开终端，确保已安装{' '}
                    <a
                      href="https://docs.anthropic.com/en/docs/claude-code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Claude Code CLI
                    </a>
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <StepNum n={2} />
                  <p className="pt-0.5 text-muted-foreground">运行以下命令（一键添加 MCP Server）：</p>
                </div>
                <ConfigBlock
                  text={`claude mcp add videonote \\
  --transport http \\
  ${mcpUrl} \\
  --header "Authorization: Bearer ${bearerKey}"`}
                  onCopy={handleCopy}
                />
                <div className="flex gap-2 text-sm">
                  <StepNum n={3} />
                  <p className="pt-0.5 text-muted-foreground">
                    启动 <code className="rounded bg-muted px-1 text-xs">claude</code>{' '}
                    命令进入对话，即可使用 VideoNote 工具
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  💡 验证连接：运行 <code className="rounded bg-background px-1">claude mcp list</code>{' '}
                  应看到 videonote
                </div>
              </TabsContent>

              {/* ─── Claude Desktop ─── */}
              <TabsContent value="claude-desktop" className="space-y-3 pt-2">
                <div className="flex gap-2 text-sm">
                  <StepNum n={1} />
                  <p className="pt-0.5 text-muted-foreground">
                    打开配置文件（需先安装{' '}
                    <a
                      href="https://claude.ai/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Claude Desktop
                    </a>
                    ）：
                    <br />
                    <strong>macOS</strong>：{`>`}{' '}
                    <code className="rounded bg-muted px-1 text-xs break-all">
                      ~/Library/Application Support/Claude/claude_desktop_config.json
                    </code>
                    <br />
                    <strong>Windows</strong>：{`>`}{' '}
                    <code className="rounded bg-muted px-1 text-xs break-all">
                      %APPDATA%\Claude\claude_desktop_config.json
                    </code>
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <StepNum n={2} />
                  <p className="pt-0.5 text-muted-foreground">
                    Claude Desktop 需用 <code className="rounded bg-muted px-1 text-xs">mcp-remote</code>{' '}
                    桥接（首次自动安装），填入以下内容：
                  </p>
                </div>
                <ConfigBlock
                  text={`{
  "mcpServers": {
    "videonote": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization: Bearer ${bearerKey}"
      ]
    }
  }
}`}
                  onCopy={handleCopy}
                />
                <div className="flex gap-2 text-sm">
                  <StepNum n={3} />
                  <p className="pt-0.5 text-muted-foreground">
                    完全退出 Claude Desktop（右键托盘图标 → Quit）后重新打开，对话中即可使用
                  </p>
                </div>
              </TabsContent>

              {/* ─── VS Code (Continue / Cline) ─── */}
              <TabsContent value="vscode" className="space-y-3 pt-2">
                <div className="flex gap-2 text-sm">
                  <StepNum n={1} />
                  <p className="pt-0.5 text-muted-foreground">
                    安装 <strong>Continue</strong> 或 <strong>Cline</strong> 扩展
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <StepNum n={2} />
                  <p className="pt-0.5 text-muted-foreground">
                    <strong>Continue</strong>：编辑{' '}
                    <code className="rounded bg-muted px-1 text-xs">~/.continue/config.json</code>
                    ，添加 MCP 配置：
                  </p>
                </div>
                <ConfigBlock
                  text={`{
  "mcpServers": {
    "videonote": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${bearerKey}"
      }
    }
  }
}`}
                  onCopy={handleCopy}
                />
                <div className="flex gap-2 text-sm">
                  <StepNum n={3} />
                  <p className="pt-0.5 text-muted-foreground">
                    重新加载 VS Code 窗口（Cmd+Shift+P → Reload Window），在 AI 聊天面板即可使用
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  💡 <strong>Cline</strong> 用户：在 Cline 设置 → MCP Servers → Add Server，选择
                  "Streamable HTTP"，填入 Server URL 和 Authorization Header
                </div>
              </TabsContent>

              {/* ─── 其他平台 ─── */}
              <TabsContent value="generic" className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  适用于任何支持 MCP Streamable HTTP 的客户端：ChatGPT Desktop、Zed、LibreChat、Gemini
                  CLI、小龙虾等。
                </p>
                <p className="text-sm font-medium">连接参数：</p>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium">协议</span>
                    <span className="text-muted-foreground">Streamable HTTP</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium">地址</span>
                    <code className="text-xs text-muted-foreground">{mcpUrl}</code>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium">鉴权</span>
                    <code className="text-xs text-muted-foreground">
                      Authorization: Bearer {bearerKey}
                    </code>
                  </div>
                </div>
                <p className="text-sm font-medium pt-1">JSON 配置：</p>
                <ConfigBlock
                  text={`{
  "mcpServers": {
    "videonote": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${bearerKey}"
      }
    }
  }
}`}
                  onCopy={handleCopy}
                />
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  💡 <strong>Zed Editor</strong>：编辑{' '}
                  <code className="rounded bg-background px-1">~/.config/zed/settings.json</code>
                  ，将 <code className="rounded bg-background px-1">mcpServers</code> 改为{' '}
                  <code className="rounded bg-background px-1">context_servers</code>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════ */}
        {/* 第三步：开始使用 */}
        {/* ════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StepNum n={3} />
              连接成功后，试试这样说
            </CardTitle>
            <CardDescription>
              在 AI 客户端的对话中直接用自然语言操作 VideoNote
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {USAGE_EXAMPLES.map((ex, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div>
                    <Badge variant="outline" className="mb-1 text-xs">
                      你说
                    </Badge>
                    <p className="text-sm">{ex.ai}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{ex.result}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════ */}
        {/* 可用能力清单 */}
        {/* ════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4" />
              可用能力清单
            </CardTitle>
            <CardDescription>
              连接后 AI 客户端可以调用的全部 {TOOL_GROUPS.reduce((s, g) => s + g.tools.length, 0)}{' '}
              个工具
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TOOL_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {group.icon}
                  </span>
                  <h4 className="text-sm font-semibold">{group.title}</h4>
                </div>
                <div className="grid gap-2 pl-9 sm:grid-cols-2">
                  {group.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-2 rounded-lg border bg-background p-2.5"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      <div className="min-w-0">
                        <code className="text-xs font-medium">{tool.name}</code>
                        <p className="mt-0.5 text-xs text-muted-foreground">{tool.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════ */}
        {/* 安全提示 */}
        {/* ════════════════════════════════════════════ */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldCheck className="size-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium">安全须知</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                <li>
                  • <strong>API Key 是你的专属凭证</strong>，每个用户独立生成，等同于账户密码
                </li>
                <li>
                  • <strong>妥善保管</strong>，不要泄露到公开仓库或聊天记录中
                </li>
                <li>
                  • <strong>重置 Key 后</strong>，使用旧 Key 的客户端会立即失效，需重新配置
                </li>
                <li>
                  • <strong>MCP 连接拥有你的全部数据权限</strong>（笔记、订阅、合集），AI
                  客户端可读写你的数据
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 新 Key 展示弹窗 */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key 已生成</DialogTitle>
            <DialogDescription>
              请立即复制保存此 Key，关闭后将无法再次查看完整内容（可重置获取新 Key）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={newKey || ''} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(newKey || '')}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRegenerateOpen(false)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
