import { useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAppStore } from '@/store/app'
import { refreshUnreadBadge } from '@/utils/unread-badge'
import house from '@/assets/tabbar/house.png'
import houseActive from '@/assets/tabbar/house-active.png'
import growth from '@/assets/tabbar/clipboard-list.png'
import growthActive from '@/assets/tabbar/clipboard-list-active.png'
import rollCall from '@/assets/tabbar/calendar-check.png'
import rollCallActive from '@/assets/tabbar/calendar-check-active.png'
import bell from '@/assets/tabbar/bell.png'
import bellActive from '@/assets/tabbar/bell-active.png'
import user from '@/assets/tabbar/user.png'
import userActive from '@/assets/tabbar/user-active.png'

const getCurrentPath = () => {
  try {
    const pages = Taro.getCurrentPages()
    const route = pages[pages.length - 1]?.route || ''
    return '/' + route.replace(/^\//, '')
  } catch {
    return '/pages/index/index'
  }
}

interface TabItem {
  key: string
  text: string
  path: string
  normal: string
  active: string
  showBadge?: boolean
}

export default function TabBar() {
  const currentRole = useAppStore((s) => s.currentRole)
  const unreadCount = useAppStore((s) => s.unreadCount)
  const current = useAppStore((s) => s.currentTabPath)

  useEffect(() => {
    const path = getCurrentPath()
    useAppStore.getState().setCurrentTabPath(path)
    const role = useAppStore.getState().currentRole
    if (role?.id) refreshUnreadBadge(role.id)
  }, [])

  const isParent = currentRole?.role_type === 'parent'

  const tabs: TabItem[] = [
    { key: 'home', text: '首页', path: '/pages/index/index', normal: house, active: houseActive },
    isParent
      ? { key: 'growth', text: '成长', path: '/pages/growth/index', normal: growth, active: growthActive }
      : { key: 'roll-call', text: '考勤', path: '/pages/roll-call/index', normal: rollCall, active: rollCallActive },
    { key: 'messages', text: '消息', path: '/pages/messages/index', normal: bell, active: bellActive, showBadge: true },
    { key: 'profile', text: '我的', path: '/pages/profile/index', normal: user, active: userActive },
  ]

  const handleTap = (path: string) => {
    useAppStore.getState().setCurrentTabPath(path)
    Taro.switchTab({ url: path })
  }

  return (
    <View
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #f0f0f0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 1000,
      }}
    >
      {tabs.map((tab) => {
        const active = current === tab.path
        return (
          <View
            key={tab.key}
            onClick={() => handleTap(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 0 4px',
            }}
          >
            <View style={{ position: 'relative' }}>
              <Image src={active ? tab.active : tab.normal} style={{ width: '22px', height: '22px' }} />
              {tab.showBadge && unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-8px',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#f5222d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: '10px', lineHeight: '16px' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: '10px', color: active ? '#E8651A' : '#999999', marginTop: '2px' }}>
              {tab.text}
            </Text>
          </View>
        )
      })}
    </View>
  )
}