import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Taro from '@tarojs/taro'
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
  needRoleSelection: boolean

  // Actions
  setLoginInfo: (info: {
    userId: string
    nickname: string
    avatarUrl: string | null
    phone: string | null
    roles: UserRole[]
    children: ChildInfo[]
  }) => void
  setCurrentRole: (index: number) => void
  setCurrentChild: (index: number) => void
  setChildren: (children: ChildInfo[]) => void
  setNeedRoleSelection: (need: boolean) => void
  logout: () => void
  wxLogin: (code: string, mockRole?: string) => Promise<{
    needRoleSelection: boolean
    targetRole: string | null
    hasBoundChildren: boolean
  }>
  fetchUserInfo: () => Promise<void>
  selectRole: (roleType: string) => Promise<void>
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
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
  needRoleSelection: false,

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
      children: info.children,
      currentChildIndex: 0,
      isLoggedIn: true,
      isLoading: false,
      needRoleSelection: false,
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

  setNeedRoleSelection: (need) => {
    set({ needRoleSelection: need })
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
      isLoading: false,
      needRoleSelection: false,
    })
  },

  wxLogin: async (code, mockRole) => {
    set({ isLoading: true })
    const url = mockRole
      ? `/api/auth/wx-login?code=${code}&mock_role=${mockRole}`
      : `/api/auth/wx-login?code=${code}`
    console.log('[Auth] wxLogin request:', { url, code, mockRole })

    try {
      const res = await Network.request({ url, method: 'GET' })
      console.log('[Auth] wxLogin response:', { statusCode: res.statusCode, data: res.data })

      // 检查 HTTP 状态码
      if (res.statusCode !== 200) {
        console.error('[Auth] wxLogin bad status:', res.statusCode)
        set({ isLoading: false })
        Taro.showToast({ title: `登录失败(${res.statusCode})`, icon: 'none' })
        return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
      }

      const data = res.data?.data
      if (data) {
        const roles = (data.roles || []) as UserRole[]
        const children = (data.children || []) as ChildInfo[]

        const currentRole = roles.length > 0 ? roles[0] : null

        set({
          userId: data.user?.id || null,
          nickname: data.user?.nickname || '',
          avatarUrl: data.user?.avatar_url || null,
          phone: data.user?.phone || null,
          roles,
          currentRole,
          currentRoleIndex: 0,
          children,
          currentChildIndex: 0,
          isLoggedIn: true,
          isLoading: false,
          needRoleSelection: data.need_role_selection || false,
        })

        console.log('[Auth] wxLogin success:', { userId: data.user?.id, roles: roles.length, children: children.length })

        return {
          needRoleSelection: data.need_role_selection || false,
          targetRole: data.target_role || null,
          hasBoundChildren: data.has_bound_children || false,
        }
      }
      // data 为空，返回 error 标记
      console.error('[Auth] wxLogin empty data:', res.data)
      set({ isLoading: false })
      Taro.showToast({ title: '登录数据异常', icon: 'none' })
      return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
    } catch (err) {
      console.error('[Auth] wxLogin error:', err)
      set({ isLoading: false })
      const errMsg = err instanceof Error ? err.message : '网络错误'
      Taro.showToast({ title: `网络错误: ${errMsg}`, icon: 'none' })
      return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
    }
  },

  fetchUserInfo: async () => {
    const { userId } = get()
    if (!userId) return

    set({ isLoading: true })
    try {
      const res = await Network.request({
        url: `/api/auth/user-info?user_id=${userId}`,
        method: 'GET',
      })
      console.log('[Auth] fetchUserInfo response:', res.data)

      const data = res.data?.data
      if (data) {
        const roles = (data.roles || []) as UserRole[]
        const children = (data.children || []) as ChildInfo[]
        const currentRole = roles.length > 0 ? roles[0] : null

        set({
          roles,
          currentRole,
          currentRoleIndex: 0,
          children,
          currentChildIndex: 0,
          isLoading: false,
        })
      }
    } catch (err) {
      console.error('[Auth] fetchUserInfo error:', err)
      set({ isLoading: false })
    }
  },

  selectRole: async (roleType) => {
    const { userId, roles } = get()
    if (!userId) return

    try {
      const res = await Network.request({
        url: '/api/auth/select-role',
        method: 'POST',
        data: { user_id: userId, role_type: roleType },
      })
      console.log('[Auth] selectRole response:', res.data)

      const index = roles.findIndex(r => r.role_type === roleType)
      if (index >= 0) {
        set({
          currentRole: roles[index],
          currentRoleIndex: index,
          needRoleSelection: false,
        })
      }
    } catch (err) {
      console.error('[Auth] selectRole error:', err)
    }
  },
}),
    {
      name: 'lgbaby-storage',
      partialize: (state) => ({
        userId: state.userId,
        nickname: state.nickname,
        avatarUrl: state.avatarUrl,
        phone: state.phone,
        roles: state.roles,
        currentRole: state.currentRole,
        currentRoleIndex: state.currentRoleIndex,
        children: state.children,
        currentChildIndex: state.currentChildIndex,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
)
