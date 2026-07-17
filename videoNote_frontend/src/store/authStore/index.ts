import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  role: string
}

interface AuthState {
  token: string | null
  refresh_token: string | null
  user: User | null
  setAuth: (token: string, user: User, refresh_token?: string | null) => void
  setToken: (token: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refresh_token: null,
      user: null,
      setAuth: (token, user, refresh_token = null) => set({ token, user, refresh_token }),
      setToken: (token) => set({ token }),
      logout: () => set({ token: null, refresh_token: null, user: null }),
      isAuthenticated: () => get().token !== null,
      isAdmin: () => get().user?.role === 'admin',
    }),
    { name: 'auth-storage' }
  )
)
