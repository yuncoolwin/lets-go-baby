import { create } from 'zustand'
import { Network } from '@/network'

export type RoleType = 'parent' | 'teacher' | 'admin' | null

export interface UserRole {
  id: string
  user_id: string
  role_type: RoleType
  real_name: string | null
  status: string
}

export interface ChildInfo {
  id: string
  name: string
  gender: string
  birth_date: string | null
  avatar_url: string | null
  relationship: string
}

interface AppStore {
  // 用户信息
  userId: string | null
  nickname: string
  avatarUrl: string | null
  phone: string | null

  // 角色信息
  roles: UserRole[]
  currentRole: UserRole | null
  currentRoleIndex: number

  // 孩子信息（家长端）
  children: ChildInfo[]
  currentChildIndex: number

  // 登录状态
  isLoggedIn: boolean
  isLoading: boolean

  // Actions
  setLoginInfo: (info: {
    userId: string
    nickname: string
    avatarUrl: string | null
    phone: string | null
    roles: UserRole[]
  }) => void
  setCurrentRole: (index: number) => void
  setCurrentChild: (index: number) => void
  setChildren: (children: ChildInfo[]) => void
  logout: () => void
  fetchUserInfo: () => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  userId: null,
  nickname: '',
  avatarUrl: null,
  phone: null,
  roles: [],
  currentRole: null,
  currentRoleIndex: 0,
  children: [],
  currentChildIndex: 0,
  isLoggedIn: false,
  isLoading: false,

  setLoginInfo: (info) => {
    const currentRole = info.roles.length > 0 ? info.roles[0] : null
    set({
      userId: info.userId,
      nickname: info.nickname,
      avatarUrl: info.avatarUrl,
      phone: info.phone,
      roles: info.roles,
      currentRole,
      currentRoleIndex: 0,
      isLoggedIn: true,
    })
  },

  setCurrentRole: (index) => {
    const { roles } = get()
    if (index >= 0 && index < roles.length) {
      set({ currentRole: roles[index], currentRoleIndex: index })
    }
  },

  setCurrentChild: (index) => {
    const { children } = get()
    if (index >= 0 && index < children.length) {
      set({ currentChildIndex: index })
    }
  },

  setChildren: (children) => {
    set({ children })
  },

  logout: () => {
    set({
      userId: null,
      nickname: '',
      avatarUrl: null,
      phone: null,
      roles: [],
      currentRole: null,
      currentRoleIndex: 0,
      children: [],
      currentChildIndex: 0,
      isLoggedIn: false,
    })
  },

  fetchUserInfo: async () => {
    set({ isLoading: true })
    try {
      const res = await Network.request({
        url: '/api/auth/user-info',
        method: 'GET',
      })
      console.log('[Auth] fetchUserInfo response:', res.data)
      const data = res.data?.data
      if (data) {
        const roles = (data.roles || []) as UserRole[]
        const currentRole = roles.length > 0 ? roles[0] : null
        set({
          userId: data.user?.id || null,
          nickname: data.user?.nickname || '',
          avatarUrl: data.user?.avatar_url || null,
          phone: data.user?.phone || null,
          roles,
          currentRole,
          currentRoleIndex: 0,
          isLoggedIn: true,
          isLoading: false,
        })
      }
    } catch (err) {
      console.error('[Auth] fetchUserInfo error:', err)
      set({ isLoading: false })
    }
  },
}))
