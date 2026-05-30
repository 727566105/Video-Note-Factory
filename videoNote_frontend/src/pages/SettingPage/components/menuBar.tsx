import { Link, useLocation } from 'react-router-dom'

export interface IMenuProps {
  id: string
  name: string
  icon: JSX.Element
  path: string
}

interface IMenuItem {
  menuItem: IMenuProps
}

const MenuBar = ({ menuItem }: IMenuItem) => {
  const location = useLocation()
  const isActive =
    location.pathname.startsWith(menuItem.path + '/') || location.pathname === menuItem.path

  return (
    <Link to={menuItem.path} className="w-full">
      <div
        className={
          'flex h-12 w-full items-center gap-1 rounded-lg px-2 transition-colors ' +
          (isActive
            ? ' bg-muted font-semibold text-primary'
            : ' text-foreground hover:bg-accent hover:text-accent-foreground')
        }
      >
        <div className="shrink-0">{menuItem.icon}</div>
        <div className="ml-3 text-[16px]">{menuItem.name}</div>
      </div>
    </Link>
  )
}

export default MenuBar
