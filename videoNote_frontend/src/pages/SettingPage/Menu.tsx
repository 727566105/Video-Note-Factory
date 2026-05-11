import {
  BotMessageSquare,
  Captions,
  HardDriveDownload,
  Info,
  BookOpen,
  Cloud,
  ListOrdered,
  Users,
} from 'lucide-react'
import MenuBar, { IMenuProps } from '@/pages/SettingPage/components/menuBar.tsx'
import { useAuthStore } from '@/store/authStore'

const Menu = () => {
  const isAdmin = useAuthStore(state => state.isAdmin())
  const user = useAuthStore(state => state.user)

  const baseMenuList: IMenuProps[] = [
    {
      id: 'siyuan',
      name: '思源笔记',
      icon: <BookOpen size={20} />,
      path: '/settings/siyuan',
    },
    {
      id: 'webdav',
      name: 'WebDAV 备份',
      icon: <Cloud size={20} />,
      path: '/settings/webdav',
    },
    {
      id: 'about',
      name: '关于',
      icon: <Info size={20} />,
      path: '/settings/about',
    },
  ]

  const adminMenuList: IMenuProps[] = [
    {
      id: 'model',
      name: 'AI 模型设置',
      icon: <BotMessageSquare size={20} />,
      path: '/settings/model',
    },
    {
      id: 'taskqueue',
      name: '任务队列',
      icon: <ListOrdered size={20} />,
      path: '/settings/taskqueue',
    },
    {
      id: 'download',
      name: '下载配置',
      icon: <HardDriveDownload size={20} />,
      path: '/settings/download',
    },
  ]

  const commonMenuList: IMenuProps[] = [
    {
      id: 'users',
      name: '用户管理',
      icon: <Users size={20} />,
      path: '/settings/users',
    },
  ]

  const menuList = isAdmin ? [...adminMenuList, ...commonMenuList, ...baseMenuList] : [...commonMenuList, ...baseMenuList]

  return (
    <div className="flex h-full flex-col">
      <div className={'flex w-full flex-col gap-2'}>
        <div className="text-2xl font-medium">设置</div>
        <div className="text-sm font-light text-foreground">
          {user?.username || '用户'} · {isAdmin ? '管理员' : '普通用户'}
        </div>
      </div>
      <div className="mt-6 flex-1">
        {menuList &&
          menuList.map(item => {
            return <MenuBar key={item.id} menuItem={item} />
          })}
      </div>
    </div>
  )
}
export default Menu