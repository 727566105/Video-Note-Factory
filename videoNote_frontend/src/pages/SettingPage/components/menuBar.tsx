import styles from './index.module.css'
import { FC, JSX } from 'react'
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

const MenuBar: ({ menuItem }: { menuItem: any }) => JSX.Element = ({ menuItem }) => {
  const location = useLocation()
  const isActive =
    location.pathname.startsWith(menuItem.path + '/') || location.pathname === menuItem.path

  return (
    <Link to={menuItem.path} className="w-full">
      <div
        className={
          styles.menuBar +
          ' flex h-12 w-full items-center gap-1 rounded px-2' +
          (isActive ? ' bg-muted font-semibold text-primary' : '')
        }
      >
        <div>{menuItem.icon}</div>
        <div className="text-[16px]">{menuItem.name}</div>
      </div>
    </Link>
  )
}

export default MenuBar
