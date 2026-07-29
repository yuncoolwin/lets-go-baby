import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { notificationApi } from '@/utils/api'
import { Bell, Plus } from 'lucide-react-taro'

interface Notification {
  id: string
  title: string
  type: string
  content: string
  is_pinned: boolean
  read_count: number
  total_count: number
  created_at: string
}

const typeOptions = [
  { value: '', label: '全部' },
  { value: 'school', label: '园所通知' },
  { value: 'class', label: '班级通知' },
  { value: 'urgent', label: '紧急通知' },
]

const typeMap: Record<string, { label: string; className: string }> = {
  school: { label: '园所', className: 'bg-blue-100 text-blue-700' },
  class: { label: '班级', className: 'bg-green-100 text-green-700' },
  urgent: { label: '紧急', className: 'bg-red-100 text-red-700' },
}

export default function NotificationManagePage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')

  const loadNotifications = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await notificationApi.list({
        type: typeFilter || undefined,
        page: 1,
        pageSize: 50,
      })
      console.log('[NotificationManage] list:', res)
      if (res.code === 200 && res.data) {
        setNotifications(res.data.list || [])
      }
    } catch (err) {
      console.error('[NotificationManage] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    if (showSkeleton) setLoading(false)
  }, [typeFilter])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleTypeChange = (type: string) => {
    setTypeFilter(type)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const getReadRate = (readCount: number, totalCount: number) => {
    if (!totalCount) return '0%'
    return `${Math.round((readCount / totalCount) * 100)}%`
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-10 w-full mb-4 rounded-lg" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      {/* 类型筛选 */}
      <View className="flex gap-2 mb-4 overflow-x-auto">
        {typeOptions.map((opt) => (
          <View
            key={opt.value}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              typeFilter === opt.value
                ? 'bg-primary text-white'
                : 'bg-white text-foreground'
            }`}
            onClick={() => handleTypeChange(opt.value)}
          >
            <Text className="text-sm">{opt.label}</Text>
          </View>
        ))}
      </View>

      {/* 通知列表 */}
      {notifications.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bell size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无通知</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {notifications.map((item) => (
            <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-2 flex-1">
                    {item.is_pinned && (
                      <Badge className="bg-red-100 text-red-700 text-xs">
                        <Text className="text-xs">置顶</Text>
                      </Badge>
                    )}
                    <Text className="text-base font-semibold text-foreground flex-1">{item.title}</Text>
                  </View>
                  <Badge className={`${typeMap[item.type]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{typeMap[item.type]?.label || item.type}</Text>
                  </Badge>
                </View>
                <View className="flex items-center justify-between">
                  <Text className="text-xs text-muted-foreground">{formatTime(item.created_at)}</Text>
                  <Text className="text-xs text-muted-foreground">
                    已读率: {getReadRate(item.read_count, item.total_count)}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 悬浮新建按钮 */}
      <View
        className="fixed right-4 bottom-20 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg"
        onClick={() => Taro.navigateTo({ url: '/pages/admin/notification-edit/index' })}
      >
        <Plus size={28} color="#ffffff" />
      </View>
    </View>
  )
}
