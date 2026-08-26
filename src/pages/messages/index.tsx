import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { notificationApi } from '@/utils/api'
import { useAppStore } from '@/store/app'
import { refreshUnreadBadge } from '@/utils/unread-badge'
import { Bell } from 'lucide-react-taro'
import TabBar from '@/components/tab-bar'
import rabbitLogo from '@/assets/rabbit-logo.png'

interface NotificationItem {
  id: string
  title: string
  content: string
  type: string
  images?: string[]
  created_at: string
  is_read?: boolean
  read_at?: string
  sender_name?: string
}

export default function MessagesPage() {
  const { currentRole, children } = useAppStore()
  const isParent = currentRole?.role_type === 'parent'

  const [receivedList, setReceivedList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useDidShow(() => {
    if (currentRole?.id) refreshUnreadBadge(currentRole.id)
  })

  useEffect(() => {
    loadReceived()
  }, [currentRole])

  const loadReceived = async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list({ scope: 'received', user_role_id: currentRole?.id })
      console.log('[Messages] received:', res)
      setReceivedList(res?.data?.list || [])
    } catch (err) {
      console.error('[Messages] loadReceived error:', err)
      setReceivedList([])
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'all': return { label: '全园', className: 'bg-red-100 text-red-700' }
      case 'course': return { label: '课程', className: 'bg-blue-100 text-blue-700' }
      case 'class': return { label: '班级', className: 'bg-green-100 text-green-700' }
      case 'personal': return { label: '个人', className: 'bg-purple-100 text-purple-700' }
      case 'teacher': return { label: '教师', className: 'bg-orange-100 text-orange-700' }
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

  const handleReceivedCardClick = async (item: NotificationItem) => {
    setDetailItem(item)
    setDetailOpen(true)
    if (!item.is_read) {
      try {
        await notificationApi.markRead(item.id, currentRole?.id || '')
        setReceivedList((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        )
        setDetailItem((prev) => (prev && prev.id === item.id ? { ...prev, is_read: true } : prev))
        refreshUnreadBadge(currentRole?.id)
      } catch (err) {
        console.error('[Messages] markRead error:', err)
      }
    }
  }

  const showUnboundTip = isParent && children.length === 0

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      {loading ? (
        <View>
          <Skeleton className="h-24 w-full mb-3 rounded-xl" />
          <Skeleton className="h-24 w-full mb-3 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </View>
      ) : showUnboundTip ? (
        <View className="flex flex-col items-center py-16">
          <Image src={rabbitLogo} className="w-16 h-16" mode="aspectFit" />
          <Text className="block text-sm text-muted-foreground mt-3 text-center">
            请先绑定幼儿{'\n'}绑定后即可查看消息
          </Text>
          <Button
            className="mt-4 bg-primary text-white rounded-xl px-6"
            onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
          >
            <Text>立即绑定</Text>
          </Button>
        </View>
      ) : receivedList.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bell size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无消息</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {receivedList.map((item) => {
            const typeBadge = getTypeBadge(item.type)
            return (
              <Card
                key={item.id}
                className="bg-white rounded-xl border-0 shadow-sm"
                onClick={() => handleReceivedCardClick(item)}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-1">
                    <View className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge className={`${typeBadge.className} text-xs flex-shrink-0`}>
                        <Text className="text-xs">{typeBadge.label}</Text>
                      </Badge>
                      {!item.is_read && (
                        <View className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      )}
                      <Text className="text-base font-semibold text-foreground truncate">{item.title}</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatTime(item.created_at)}
                    </Text>
                  </View>

                  <Text
                    className="block text-sm text-muted-foreground"
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
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

      {/* 详情半屏弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '85vh' }}>
          <DialogHeader>
            <DialogTitle>
              <View className="flex items-center gap-2 flex-wrap">
                {detailItem && (
                  <Badge className={`${getTypeBadge(detailItem.type).className} text-xs flex-shrink-0`}>
                    <Text className="text-xs">{getTypeBadge(detailItem.type).label}</Text>
                  </Badge>
                )}
                <Text className="text-lg font-semibold text-foreground flex-1 min-w-0">
                  {detailItem?.title || '通知详情'}
                </Text>
                {detailItem && (
                  <Text className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(detailItem.created_at)}
                  </Text>
                )}
              </View>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="mt-4" style={{ maxHeight: '60vh' }}>
            {detailItem && (
              <View className="space-y-3">
                <Text className="block text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailItem.content}
                </Text>
                {Array.isArray(detailItem.images) && detailItem.images.length > 0 && (
                  <View className="space-y-2">
                    {detailItem.images.map((url, idx) => (
                      <Image key={idx} src={url} className="w-full rounded-lg" mode="widthFix" />
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>
      <TabBar />
    </View>
  )
}