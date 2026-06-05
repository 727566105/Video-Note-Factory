import { LoginForm } from "@/components/login-form"
import logo from "@/assets/logo.png"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <img src={logo} alt="logo" className="size-4 rounded" />
            </div>
            <span className="font-semibold tracking-tight">VideoNote</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-border/70 bg-muted/40 lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--primary-light),transparent_42%),linear-gradient(180deg,var(--card),var(--background))]" />
        <div className="relative flex h-full flex-col justify-center gap-8 p-12 xl:p-16">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary">AI 视频笔记工作台</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
              把长视频变成可检索、可复用的知识资产
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              导入链接或本地音视频，自动生成摘要、转写、截图和结构化笔记。
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-2xl shadow-primary/10">
            <img
              src="/preview_1.png"
              alt="VideoNote 产品界面预览"
              className="aspect-[16/10] w-full rounded-xl object-cover object-left-top"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
