import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Github, Star, ExternalLink, Download } from 'lucide-react'
import logo from '@/assets/logo.png'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export default function AboutPage() {
  const isMobile = useIsMobile()

  return (
    <div className={'h-full overflow-auto bg-background'}>
      <div className="container mx-auto px-4 py-6 md:py-12">
        {/* Hero Section */}
        <div className="mb-8 md:mb-16 flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex items-center gap-3 md:gap-4">
            <img
              src={logo}
              alt="videoNote Logo"
              width={isMobile ? 40 : 50}
              height={isMobile ? 40 : 50}
              className="rounded-lg"
            />
<h1 className={isMobile ? 'text-2xl font-bold' : 'text-4xl font-bold'}>videoNote v3.0.35</h1>
          </div>
          <p className={cn(
            "text-muted-foreground mb-4 md:mb-6 italic",
            isMobile ? "text-base" : "text-xl"
          )}>
            AI 视频笔记生成工具 让 AI 为你的视频做笔记
          </p>

          <div className="mb-6 md:mb-8 flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">MIT License</Badge>
            <Badge variant="secondary">React</Badge>
            <Badge variant="secondary">FastAPI</Badge>
            <Badge variant="secondary">Docker Compose</Badge>
            <Badge variant="secondary">Active</Badge>
          </div>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            <Button variant="outline" asChild size={isMobile ? 'sm' : 'default'}>
              <a href="https://github.com/727566105/Video-Note-Factory" target="_blank">
                <Github className="mr-2 h-4 w-4" />
                GitHub 仓库
              </a>
            </Button>
          </div>
        </div>

        {/* Project Introduction */}
        <section className="mb-8 md:mb-16">
          <h2 className={cn(
            "mb-4 md:mb-6 text-center font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>✨ 项目简介</h2>
          <div className="mx-auto max-w-3xl text-center">
            <p className={isMobile ? "text-base" : "text-lg"}>
              videoNote 是一个开源的 AI 视频笔记助手，支持通过哔哩哔哩、YouTube、抖音等视频链接，
              自动提取内容并生成结构清晰、重点明确的 Markdown
              格式笔记。支持插入截图、原片跳转、思源笔记导出、WebDAV 备份、工具栏自定义等丰富功能。
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-8 md:mb-16">
          <h2 className={cn(
            "mb-6 md:mb-8 text-center font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>🔧 功能特性</h2>
          <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: '多平台支持', desc: '支持 Bilibili、YouTube、本地视频、抖音等多个平台' },
              { title: '笔记格式选择', desc: '支持返回多种笔记格式，满足不同需求' },
              { title: '笔记风格选择', desc: '支持多种笔记风格，个性化定制' },
              { title: '多模态视频理解', desc: '结合视觉和音频内容，全面理解视频' },
              { title: '自定义 GPT 配置', desc: '支持自行配置 GPT 大模型' },
              { title: '本地音频转写', desc: '支持 Fast-Whisper 等本地模型音频转写' },
              { title: '结构化笔记', desc: '自动生成结构化 Markdown 笔记' },
              { title: '智能截图', desc: '可选插入自动截取的关键画面' },
              { title: '内容跳转', desc: '支持关联原视频的内容跳转链接' },
              { title: '工具栏自定义', desc: '支持自定义工具栏按钮布局，灵活配置显示方式' },
              { title: '思源笔记导出', desc: '一键导出笔记到思源笔记，实现知识管理闭环' },
              { title: 'WebDAV 备份', desc: '支持 WebDAV 自动备份，保障数据安全' },
            ].map((feature, index) => (
              <Card key={index} className="h-full">
                <CardContent className="pt-2">
                  <h3 className={cn(
                    "mb-2 font-semibold",
                    isMobile ? "text-base" : "text-xl"
                  )}>{feature.title}</h3>
                  <p className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-sm" : ""
                  )}>{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        
        {/* Quick Start Section */}
        <section className="mb-8 md:mb-16">
          <h2 className={cn(
            "mb-6 md:mb-8 text-center font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>🚀 快速开始</h2>
          <Tabs defaultValue="manual" className="mx-auto max-w-3xl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">手动安装</TabsTrigger>
              <TabsTrigger value="docker">Docker 部署</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
              <div>
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>1. 克隆仓库</h3>
                <div className="bg-muted rounded-md p-3 md:p-4 font-mono text-xs md:text-sm">
                  git clone https://github.com/JefferyHcool/VideoNoteFactory.git
                  <br />
                  cd VideoNoteFactory
                  <br />
                  mv .env.example .env
                </div>
              </div>
              <div>
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>2. 启动后端（FastAPI）</h3>
                <div className="bg-muted rounded-md p-3 md:p-4 font-mono text-xs md:text-sm">
                  cd backend
                  <br />
                  pip install -r requirements.txt
                  <br />
                  python main.py
                </div>
              </div>
              <div>
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>3. 启动前端（Vite + React）</h3>
                <div className="bg-muted rounded-md p-3 md:p-4 font-mono text-xs md:text-sm">
                  cd videoNote_frontend
                  <br />
                  pnpm install
                  <br />
                  pnpm dev
                </div>
              </div>
              <p className={isMobile ? "text-sm" : ""}>
                访问：<code className="bg-muted rounded px-2 py-1">http://localhost:3015</code>
              </p>
            </TabsContent>
            <TabsContent value="docker" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
              <div>
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>1. 克隆仓库</h3>
                <div className="bg-muted rounded-md p-3 md:p-4 font-mono text-xs md:text-sm">
                  git clone https://github.com/JefferyHcool/VideoNoteFactory.git
                  <br />
                  cd VideoNoteFactory
                  <br />
                  mv .env.example .env
                </div>
              </div>
              <div>
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>2. 启动 Docker Compose</h3>
                <div className="bg-muted rounded-md p-3 md:p-4 font-mono text-xs md:text-sm">
                  docker compose up --build
                </div>
              </div>
              <p className={isMobile ? "text-sm" : ""}>
                默认端口：
                <br />
                前端：http://localhost:${'{FRONTEND_PORT}'}
                <br />
                后端：http://localhost:${'{BACKEND_PORT}'}
                <br />
                <span className="text-muted-foreground text-xs md:text-sm">
                  .env 文件中可自定义端口与环境配置
                </span>
              </p>
            </TabsContent>
          </Tabs>
        </section>

        {/* Community Section */}
        <section className="mb-8 md:mb-16">
          <h2 className={cn(
            "mb-6 md:mb-8 text-center font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>联系和加入社区</h2>
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col items-center justify-center gap-6 md:gap-8">
              <div className="text-center">
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>videoNote 交流 QQ 群</h3>
                <p className={cn(
                  "font-medium",
                  isMobile ? "text-base" : "text-lg"
                )}>785367111</p>
              </div>
              <div className="text-center">
                <h3 className={cn(
                  "mb-2 md:mb-3 font-semibold",
                  isMobile ? "text-base" : "text-xl"
                )}>videoNote 交流微信群</h3>
                <div className="bg-muted mx-auto flex h-40 w-40 md:h-52 md:w-52 items-center justify-center rounded-md">
                  <img src={'/wechat-qr.svg'} alt="视频交流微信群" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* License Section */}
        <section className="mb-6 md:mb-8 text-center">
          <h2 className={cn(
            "mb-3 md:mb-4 font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>📜 License</h2>
          <p className={isMobile ? "text-sm" : ""}>MIT License</p>
        </section>

        {/* Footer */}
        <footer className="border-t pt-6 md:pt-8 text-center">
          <p className={cn(
            "mb-4",
            isMobile ? "text-sm" : ""
          )}>💬 你的支持与反馈是我持续优化的动力！欢迎 PR、提 issue、Star ⭐️</p>
        </footer>
      </div>
    </div>
  )
}
