import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { notificationApi } from '@/utils/api'
import { Bell } from 'lucide-react-taro'

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
  { value: 'all', label: '全园' },
  { value: 'course', label: '课程' },
  { value: 'class', label: '班级' },
  { value: 'personal', label: '个人' },
  { value: 'teacher', label: '教师' },
]

const typeMap: Record<string, { label: string; className: string }> = {
  all: { label: '全园', className: 'bg-red-100 text-red-700' },
  course: { label: '课程', className: 'bg-blue-100 text-blue-700' },
  class: { label: '班级', className: 'bg-green-100 text-green-700' },
  personal: { label: '个人', className: 'bg-purple-100 text-purple-700' },
  teacher: { label: '教师', className: 'bg-orange-100 text-orange-700' },
}

export default function NotificationManagePage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [detailItem, setDetailItem] = useState<Notification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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
    <View className="min-h-screen bg-background p-4 pb-28">
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
            <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm" onClick={() => { setDetailItem(item); setDetailOpen(true) }}>
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

      {/* 底部固定按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #f0f0f0',
          padding: '12px 16px', zIndex: 100
        }}
      >
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={() => Taro.navigateTo({ url: '/pages/teacher-notification/index' })}
        >
          <Text className="text-white">新增通知</Text>
        </Button>
      </View>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">{detailItem?.title || '通知详情'}</Text>
            </DialogTitle>
          </DialogHeader>
          <View className="mt-4 space-y-3">
            {detailItem && (
              <>
                <View className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${typeMap[detailItem.type]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{typeMap[detailItem.type]?.label || detailItem.type}</Text>
                  </Badge>
                  {detailItem.is_pinned && (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      <Text className="text-xs">置顶</Text>
                    </Badge>
                  )}
                </View>
                <Text className="block text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailItem.content}
                </Text>
                <View className="flex items-center justify-between">
                  <Text className="text-xs text-muted-foreground">{formatTime(detailItem.created_at)}</Text>
                  <Text className="text-xs text-muted-foreground">
                    已读率: {getReadRate(detailItem.read_count, detailItem.total_count)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
