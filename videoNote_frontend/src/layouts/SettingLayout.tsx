import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import React from 'react'
import {
  Bell,
  BookOpen,
  Box,
  ChevronRight,
  DatabaseBackup,
  Download,
  HardDrive,
  Info,
  ListTodo,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserCog,
  WandSparkles,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuthStore } from '@/store/authStore'
import { ThemeModeSelector } from '@/components/ThemeModeSelector'

type SettingItem = {
  path: string
  label: string
  description: string
  icon: React.ReactNode
  adminOnly?: boolean
}

type SettingGroup = {
  id: string
  title: string
  description: string
  accent: string
  items: SettingItem[]
}

const settingGroups: SettingGroup[] = [
  {
    id: 'workspace',
    title: '账号与工作区',
    description: '个人信息、身份与成员管理',
    accent: 'from-sky-500/14 to-emerald-400/12',
    items: [
      {
        path: '/settings/profile',
        label: '个人资料',
        description: '账号信息、密码和身份',
        icon: <User className="size-4" />,
      },
      {
        path: '/settings/users',
        label: '用户管理',
        description: '成员、角色和权限',
        icon: <UserCog className="size-4" />,
        adminOnly: true,
      },
    ],
  },
  {
    id: 'data',
    title: '基础数据设置',
    description: '笔记同步、数据备份、整机迁移与配置管理',
    accent: 'from-amber-500/14 to-orange-400/10',
    items: [
      {
        path: '/settings/siyuan',
        label: '思源笔记',
        description: '同步笔记到思源工作区',
        icon: <BookOpen className="size-4" />,
      },
      {
        path: '/settings/obsidian',
        label: 'Obsidian',
        description: '同步笔记到 Obsidian 知识库',
        icon: <Box className="size-4" />,
      },
      {
        path: '/settings/webdav',
        label: 'WebDAV 备份',
        description: '备份配置与恢复数据',
        icon: <HardDrive className="size-4" />,
      },
      {
        path: '/settings/data',
        label: '基础数据设置',
        description: '整机迁移与配置管理',
        icon: <DatabaseBackup className="size-4" />,
      },
    ],
  },
  {
    id: 'automation',
    title: 'AI 与处理',
    description: '模型、下载器和订阅自动化',
    accent: 'from-blue-500/14 to-violet-400/10',
    items: [
      {
        path: '/settings/model',
        label: '模型设置',
        description: '供应商、密钥和默认模型',
        icon: <Sparkles className="size-4" />,
        adminOnly: true,
      },
      {
        path: '/settings/download',
        label: '下载配置',
        description: '下载器、平台 Cookie 和解析能力',
        icon: <Download className="size-4" />,
        adminOnly: true,
      },
      {
        path: '/settings/subscription',
        label: '订阅设置',
        description: '频道抓取、刷新频率和自动同步',
        icon: <Bell className="size-4" />,
        adminOnly: true,
      },
    ],
  },
  {
    id: 'system',
    title: '系统管理',
    description: '后台任务和产品信息',
    accent: 'from-slate-500/12 to-cyan-400/10',
    items: [
      {
        path: '/settings/taskqueue',
        label: '任务队列',
        description: '后台任务、失败重试和运行状态',
        icon: <ListTodo className="size-4" />,
        adminOnly: true,
      },
      {
        path: '/settings/about',
        label: '关于',
        description: '版本、项目和支持信息',
        icon: <Info className="size-4" />,
      },
    ],
  },
]

function getVisibleGroups(isAdmin: boolean) {
  return settingGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.adminOnly || isAdmin),
    }))
    .filter(group => group.items.length > 0)
}

function isActivePath(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

function SettingsHome({
  groups,
  isAdmin,
}: {
  groups: SettingGroup[]
  isAdmin: boolean
}) {
  const navigate = useNavigate()
  const totalItems = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <div className="h-full overflow-auto bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.46)_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: "url('/settings-background.svg')" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.88)_43%,hsl(var(--background)/0.38)_100%)]" />
          <div className="relative flex min-h-[190px] flex-col justify-end gap-4 p-5 md:p-7">
            <div className="flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Settings className="size-3.5 text-primary" />
              设置中心
            </div>
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
                把账号、AI、同步和系统管理收在一个清晰入口
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                当前可配置 {totalItems} 个模块，按使用频率和职责边界重新分组。
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {groups.map(group => (
              <section key={group.id} className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{group.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  </div>
                  <div className={`h-10 w-16 rounded-full bg-gradient-to-br ${group.accent}`} />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(item => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="group flex min-h-[118px] flex-col justify-between rounded-xl border border-border/70 bg-background p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          {item.icon}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
              <ThemeModeSelector />
            </section>
            <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">当前权限</h2>
                  <p className="text-sm text-muted-foreground">{isAdmin ? '管理员工作台' : '个人工作区'}</p>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <WandSparkles className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">建议顺序</h2>
                  <p className="text-sm leading-5 text-muted-foreground">先完成模型和下载配置，再接入同步与备份。</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function SettingsNavigation({
  groups,
  pathname,
}: {
  groups: SettingGroup[]
  pathname: string
}) {
  const navigate = useNavigate()

  return (
    <aside className="hidden w-[284px] shrink-0 border-r border-border/70 bg-muted/25 lg:flex lg:flex-col">
      <div className="border-b border-border/70 p-5">
        <button
          onClick={() => navigate('/settings')}
          className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-background"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Settings className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">设置中心</div>
            <div className="truncate text-xs text-muted-foreground">统一管理系统偏好</div>
          </div>
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        {groups.map(group => (
          <div key={group.id}>
            <div className="mb-2 px-2">
              <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {group.title}
              </div>
            </div>
            <div className="space-y-1">
              {group.items.map(item => {
                const active = isActivePath(pathname, item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={[
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                        active ? 'bg-primary/12 text-primary' : 'bg-background/70 text-muted-foreground group-hover:text-primary',
                      ].join(' ')}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border/70 p-4">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm">
          <ThemeModeSelector compact />
        </div>
      </div>
    </aside>
  )
}

function MobileSettingsHome({ groups }: { groups: SettingGroup[] }) {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-auto bg-background p-4">
      <div className="mb-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Settings className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">设置中心</h1>
            <p className="text-sm text-muted-foreground">按场景整理配置入口</p>
          </div>
        </div>
      </div>
      <div className="mb-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <ThemeModeSelector compact />
      </div>
      <div className="space-y-5">
        {groups.map(group => (
          <section key={group.id}>
            <div className="mb-2 px-1">
              <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
            <div className="space-y-2">
              {group.items.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 text-left shadow-sm transition-colors active:bg-muted"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const SettingLayout = () => {
  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()
  const isAdmin = useAuthStore(state => state.isAdmin())
  const groups = React.useMemo(() => getVisibleGroups(isAdmin), [isAdmin])
  const isSettingsRoot = location.pathname === '/settings'

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isSettingsRoot) {
    return isMobile ? (
      <MobileSettingsHome groups={groups} />
    ) : (
      <SettingsHome groups={groups} isAdmin={isAdmin} />
    )
  }

  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      <SettingsNavigation groups={groups} pathname={location.pathname} />
      <main className="min-w-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.3))]">
        <div className="h-full overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default SettingLayout
