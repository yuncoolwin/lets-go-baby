import { useAppStore } from '@/store/app'
import { Network } from '@/network'
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

/**
 * 拉取成长记录未读数并写入 store（底部成长 tab 角标用）
 * - userRoleId 为空：清零
 * - childId：超管代理场景指定幼儿（后端按 agentChildId 过滤）
 */
export async function refreshGrowthUnreadBadge(userRoleId?: string, childId?: string) {
  if (!userRoleId) {
    useAppStore.getState().setGrowthUnreadCount(0)
    return
  }
  try {
    const url = childId
      ? `/api/parent/growth-records/unread-counts?child_id=${encodeURIComponent(childId)}`
      : '/api/parent/growth-records/unread-counts'
    const res = await Network.request({ url, method: 'GET' })
    const count = res?.data?.data ?? 0
    useAppStore.getState().setGrowthUnreadCount(Number(count) || 0)
  } catch (e) {
    console.error('[UnreadBadge] refresh growth unread error:', e)
  }
}
