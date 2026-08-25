import Taro from '@tarojs/taro'
import { notificationApi } from './api'

/**
 * 刷新底部导航「消息」tab 的未读角标
 * 入参当前角色 id；无角色或 count=0 时移除角标
 */
export async function refreshUnreadBadge(userRoleId?: string) {
  try {
    if (!userRoleId) {
      await Taro.removeTabBarBadge({ index: 2 })
      return
    }
    const res = await notificationApi.unreadCount(userRoleId)
    const count = res?.data?.count ?? 0
    if (count > 0) {
      await Taro.setTabBarBadge({ index: 2, text: String(count) })
    } else {
      await Taro.removeTabBarBadge({ index: 2 })
    }
  } catch (err) {
    console.error('[refreshUnreadBadge] error:', err)
  }
}