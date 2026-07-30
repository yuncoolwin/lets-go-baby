import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { Bell } from 'lucide-react-taro'

interface NotificationItem {
  id: string
  title: string
  content: string
  type: string
  created_at: string
  sender_name?: string
}

export default function MessagesPage() {
  const { currentRole } = useAppStore()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [currentRole])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/notifications',
        method: 'GET',
      })
      console.log('[Messages] notifications:', res.data)
      const responseData = res.data?.data
      if (Array.isArray(responseData)) {
        setNotifications(responseData)
      } else if (responseData?.list && Array.isArray(responseData.list)) {
        setNotifications(responseData.list)
      } else {
        setNotifications([])
      }
    } catch (err) {
      console.error('[Messages] error:', err)
    }
    setLoading(false)
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'system': return { label: '系统', className: 'bg-blue-100 text-blue-700' }
      case 'class': return { label: '班级', className: 'bg-green-100 text-green-700' }
      case 'activity': return { label: '活动', className: 'bg-purple-100 text-purple-700' }
      default: return { label: '通知', className: 'bg-gray-100 text-gray-700' }
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <Text className="block text-lg font-bold text-foreground mb-4">消息通知</Text>

      {notifications.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bell size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无消息</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {notifications.map((item) => {
            const typeBadge = getTypeBadge(item.type)
            return (
              <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Badge className={`${typeBadge.className} text-xs`}>
                      <Text className="text-xs">{typeBadge.label}</Text>
                    </Badge>
                    <Text className="text-xs text-muted-foreground">
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                  <Text className="block text-base font-semibold text-foreground mb-1">
                    {item.title}
                  </Text>
                  <Text className="block text-sm text-muted-foreground">
                    {item.content}
                  </Text>
                  {item.sender_name && (
                    <Text className="block text-xs text-muted-foreground mt-2">
                      来自: {item.sender_name}
                    </Text>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}
    </View>
  )
}
