import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { authApi } from '@/utils/api'

export type RoleType = 'parent' | 'teacher' | 'admin' | 'superadmin' | null

export interface UserRole {
  id: string
  user_id: string
  role_type: RoleType
  real_name: string | null
  status: string
  class_id?: string | null
}

export interface ChildInfo {
  id: string
  child_id?: string
  name: string
  nickname?: string
  gender: string
  birth_date: string | null
  avatar_url: string | null
  relationship: string
  custom_relationship?: string | null
  allergies?: string | null
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

  // 消息未读数（custom tabBar 角标用）
  unreadCount: number

  // 当前 tab 路径（底部 tabBar 选中态）
  currentTabPath: string

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
  setUnreadCount: (count: number) => void
  setCurrentTabPath: (path: string) => void
  setCurrentChild: (index: number) => void
  setChildren: (children: ChildInfo[]) => void
  setNeedRoleSelection: (need: boolean) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
  wxLogin: (code: string, mockRole?: string) => Promise<{
    needRoleSelection: boolean
    targetRole: string | null
    hasBoundChildren: boolean
    error?: boolean
  }>
  phoneLogin: (loginCode: string, phoneCode?: string, mockRole?: string) => Promise<{
    needRoleSelection: boolean
    targetRole: string | null
    hasBoundChildren: boolean
    error?: boolean
  }>
  fetchUserInfo: () => Promise<void>
  selectRole: (roleType: string) => Promise<void>
}

// Taro Storage 适配器（替代 localStorage，兼容小程序环境）
const taroStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof Taro !== 'undefined' && Taro.getStorageSync) {
        const value = Taro.getStorageSync(name)
        return value != null ? String(value) : null
      }
      return null
    } catch {
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      if (typeof Taro !== 'undefined' && Taro.setStorageSync) {
        Taro.setStorageSync(name, value)
      }
    } catch {
      // 静默失败
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      if (typeof Taro !== 'undefined' && Taro.removeStorageSync) {
        Taro.removeStorageSync(name)
      }
    } catch {
      // 静默失败
    }
  },
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
  unreadCount: 0,
  currentTabPath: '',
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

  setUnreadCount: (count) => {
    set({ unreadCount: count })
  },

  setCurrentTabPath: (path) => {
    set({ currentTabPath: path })
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

  setIsLoading: (loading) => {
    set({ isLoading: loading })
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
      currentTabPath: '',
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

    // 10秒超时处理
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('登录超时，请检查网络后重试')), 10000)
    })

    try {
      const res = await Promise.race([
        Network.request({ url, method: 'GET', timeout: 10000 }),
        timeoutPromise,
      ])
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

        // 根据 target_role 优先匹配对应角色
        const targetRoleType = data.target_role || 'parent'
        const currentRoleIndex = roles.findIndex(r => r.role_type === targetRoleType)
        const currentRole = currentRoleIndex >= 0 ? roles[currentRoleIndex] : (roles.length > 0 ? roles[0] : null)

        set({
          userId: data.user?.id || null,
          nickname: data.user?.nickname || '',
          avatarUrl: data.user?.avatar_url || null,
          phone: data.user?.phone || null,
          roles,
          currentRole,
          currentRoleIndex: currentRoleIndex >= 0 ? currentRoleIndex : 0,
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
      Taro.showToast({ title: errMsg, icon: 'none' })
      return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
    }
  },

  phoneLogin: async (loginCode, phoneCode, mockRole) => {
    set({ isLoading: true })
    console.log('[Auth] phoneLogin request:', { loginCode, hasPhoneCode: !!phoneCode, mockRole })

    try {
      const res = await authApi.phoneLogin({
        login_code: loginCode,
        phone_code: phoneCode,
        mock_role: mockRole,
      })
      console.log('[Auth] phoneLogin response:', { statusCode: res.statusCode, data: res.data })

      if (res.statusCode !== 200) {
        console.error('[Auth] phoneLogin bad status:', res.statusCode)
        set({ isLoading: false })
        Taro.showToast({ title: `登录失败(${res.statusCode})`, icon: 'none' })
        return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
      }

      const data = res.data?.data
      if (data) {
        const roles = (data.roles || []) as UserRole[]
        const children = (data.children || []) as ChildInfo[]
        const targetRoleType = data.target_role || 'parent'
        const currentRoleIndex = roles.findIndex(r => r.role_type === targetRoleType)
        const currentRole = currentRoleIndex >= 0 ? roles[currentRoleIndex] : (roles.length > 0 ? roles[0] : null)

        set({
          userId: data.user?.id || null,
          nickname: data.user?.nickname || '',
          avatarUrl: data.user?.avatar_url || null,
          phone: data.user?.phone || null,
          roles,
          currentRole,
          currentRoleIndex: currentRoleIndex >= 0 ? currentRoleIndex : 0,
          children,
          currentChildIndex: 0,
          isLoggedIn: true,
          isLoading: false,
          needRoleSelection: data.need_role_selection || false,
        })

        console.log('[Auth] phoneLogin success:', { userId: data.user?.id, roles: roles.length, children: children.length })

        return {
          needRoleSelection: data.need_role_selection || false,
          targetRole: data.target_role || null,
          hasBoundChildren: data.has_bound_children || false,
        }
      }

      console.error('[Auth] phoneLogin empty data:', res.data)
      set({ isLoading: false })
      Taro.showToast({ title: '登录数据异常', icon: 'none' })
      return { needRoleSelection: false, targetRole: null, hasBoundChildren: false, error: true }
    } catch (err) {
      console.error('[Auth] phoneLogin error:', err)
      set({ isLoading: false })
      const errMsg = err instanceof Error ? err.message : '网络错误'
      Taro.showToast({ title: errMsg, icon: 'none' })
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
        // 保留当前已选择的角色，不覆盖用户手动切换的角色
        const { currentRole: existingRole, currentRoleIndex: existingIndex } = get()
        let currentRole: UserRole | null = existingRole
        let currentRoleIndex = existingIndex
        if (!currentRole || !roles.find(r => r.id === currentRole!.id)) {
          currentRole = roles.length > 0 ? roles[0] : null
          currentRoleIndex = 0
        }

        const { currentChildIndex: existingChildIndex } = get()
        const currentChildIndex = existingChildIndex < children.length ? existingChildIndex : 0

        set({
          roles,
          currentRole,
          currentRoleIndex,
          children,
          currentChildIndex,
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
      storage: createJSONStorage(() => taroStorage),
      partialize: (state) => ({
        userId: state.userId,
        nickname: state.nickname,
        avatarUrl: state.avatarUrl,
        phone: state.phone,
        roles: state.roles,
        currentRole: state.currentRole,
        currentRoleIndex: state.currentRoleIndex,
        unreadCount: state.unreadCount,
        children: state.children,
        currentChildIndex: state.currentChildIndex,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
)
