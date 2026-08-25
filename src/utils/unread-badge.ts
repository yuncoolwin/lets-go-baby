import { useAppStore } from '@/store/app'
import { notificationApi } from './api'

/**
 * 刷新底部导航「消息」tab 的未读角标
 * 入参当前角色 id；无角色或 count=0 时清空角标
 * custom tabBar 下不再使用 Taro.setTabBarBadge，改为写入全局 store 状态
 */
export async function refreshUnreadBadge(userRoleId?: string) {
  try {
    if (!userRoleId) {
      useAppStore.getState().setUnreadCount(0)
      return
    }
    const res = await notificationApi.unreadCount(userRoleId)
    const count = res?.data?.count ?? 0
    useAppStore.getState().setUnreadCount(count)
  } catch (err) {
    console.error('[refreshUnreadBadge] error:', err)
  }
}