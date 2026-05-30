import {
  BotMessageSquare,
  HardDriveDownload,
  Info,
  BookOpen,
  Cloud,
  ListOrdered,
  Users,
  Rss,
} from 'lucide-react'
import MenuBar, { IMenuProps } from '@/pages/SettingPage/components/menuBar.tsx'
import { useAuthStore } from '@/store/authStore'

const Menu = () => {
  const isAdmin = useAuthStore(state => state.isAdmin())

  const adminMenuList: IMenuProps[] = [
    {
      id: 'model',
      name: 'AI 模型设置',
      icon: <BotMessageSquare className="size-5" />,
      path: '/settings/model',
    },
    {
      id: 'taskqueue',
      name: '任务队列',
      icon: <ListOrdered className="size-5" />,
      path: '/settings/taskqueue',
    },
    {
      id: 'download',
      name: '下载配置',
      icon: <HardDriveDownload className="size-5" />,
      path: '/settings/download',
    },
    {
      id: 'subscription',
      name: '订阅设置',
      icon: <Rss className="size-5" />,
      path: '/settings/subscription',
    },
  ]

  const commonMenuList: IMenuProps[] = [
    {
      id: 'users',
      name: '用户管理',
      icon: <Users className="size-5" />,
      path: '/settings/users',
    },
  ]

  const baseMenuList: IMenuProps[] = [
    {
      id: 'siyuan',
      name: '思源笔记',
      icon: <BookOpen className="size-5" />,
      path: '/settings/siyuan',
    },
    {
      id: 'webdav',
      name: 'WebDAV 备份',
      icon: <Cloud className="size-5" />,
      path: '/settings/webdav',
    },
    {
      id: 'about',
      name: '关于',
      icon: <Info className="size-5" />,
      path: '/settings/about',
    },
  ]

  // 分隔线组件
  const Divider = () => (
    <div data-orientation="horizontal" role="none" className="shrink-0 bg-border h-[1px] w-full my-2" />
  )

  return (
    <div className="flex h-full flex-col">
      <div className="mt-6 flex-1">
        {/* 管理员设置 */}
        {isAdmin && (
          <>
            {adminMenuList.map(item => <MenuBar key={item.id} menuItem={item} />)}
            <Divider />
          </>
        )}

        {/* 用户设置 */}
        {commonMenuList.map(item => <MenuBar key={item.id} menuItem={item} />)}
        <Divider />

        {/* 笔记集成 */}
        {baseMenuList.map(item => <MenuBar key={item.id} menuItem={item} />)}
      </div>
    </div>
  )
}
export default Menu