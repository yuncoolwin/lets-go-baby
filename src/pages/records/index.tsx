import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { BookOpen, Plus } from 'lucide-react-taro'

interface FeedbackItem {
  id: string
  child_name: string
  feedback_date: string
  meal_status: string | null
  sleep_status: string | null
  mood_status: string | null
  activities: string | null
  notes: string | null
  teacher_name: string
}

export default function RecordsPage() {
  const { currentRole } = useAppStore()
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeedbacks()
  }, [currentRole])

  const loadFeedbacks = async () => {
    setLoading(true)
    try {
      const url = currentRole?.role_type === 'teacher'
        ? '/api/teacher/feedbacks'
        : '/api/parent/feedbacks'
      const res = await Network.request({ url, method: 'GET' })
      console.log('[Records] feedbacks:', res.data)
      if (res.data?.data) {
        setFeedbacks(res.data.data)
      }
    } catch (err) {
      console.error('[Records] error:', err)
    }
    setLoading(false)
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'good': case 'happy': return '好'
      case 'normal': return '一般'
      case 'poor': case 'upset': return '差'
      default: return '—'
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'good': case 'happy': return 'bg-green-100 text-green-700'
      case 'normal': return 'bg-yellow-100 text-yellow-700'
      case 'poor': case 'upset': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-500'
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-32 w-full mb-3 rounded-xl" />
        <Skeleton className="h-32 w-full mb-3 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </View>
    )
  }

  // 教师端：可以查看和新增记录
  if (currentRole?.role_type === 'teacher') {
    return (
      <View className="min-h-screen bg-background p-4">
        <View className="flex items-center justify-between mb-4">
          <Text className="block text-lg font-bold text-foreground">日常记录</Text>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground rounded-lg"
            onClick={() => {
              // TODO: 打开新增记录弹窗
            }}
          >
            <Plus size={14} className="mr-1" color="#fff" />
            <Text className="text-xs text-primary-foreground">新增</Text>
          </Button>
        </View>

        {feedbacks.length === 0 ? (
          <View className="flex flex-col items-center py-16">
            <BookOpen size={48} color="#999999" />
            <Text className="block text-sm text-muted-foreground mt-3">暂无记录</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {feedbacks.map((item) => (
              <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="block text-base font-semibold text-foreground">
                      {item.child_name}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{item.feedback_date}</Text>
                  </View>
                  <View className="flex gap-2 mb-2">
                    <Badge className={`${getStatusBadge(item.meal_status)} text-xs`}>
                      <Text className="text-xs">饮食: {getStatusLabel(item.meal_status)}</Text>
                    </Badge>
                    <Badge className={`${getStatusBadge(item.sleep_status)} text-xs`}>
                      <Text className="text-xs">睡眠: {getStatusLabel(item.sleep_status)}</Text>
                    </Badge>
                    <Badge className={`${getStatusBadge(item.mood_status)} text-xs`}>
                      <Text className="text-xs">情绪: {getStatusLabel(item.mood_status)}</Text>
                    </Badge>
                  </View>
                  {item.activities && (
                    <Text className="block text-sm text-foreground mt-2">
                      活动: {item.activities}
                    </Text>
                  )}
                  {item.notes && (
                    <Text className="block text-xs text-muted-foreground mt-1">
                      备注: {item.notes}
                    </Text>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>
    )
  }

  // 家长端：查看每日反馈
  return (
    <View className="min-h-screen bg-background p-4">
      <Text className="block text-lg font-bold text-foreground mb-4">每日反馈</Text>

      {feedbacks.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <BookOpen size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无反馈记录</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {feedbacks.map((item) => (
            <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-3">
                  <Text className="text-xs text-muted-foreground">{item.feedback_date}</Text>
                  <Text className="text-xs text-muted-foreground">{item.teacher_name}</Text>
                </View>
                <View className="space-y-2">
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-foreground">饮食</Text>
                    <Badge className={`${getStatusBadge(item.meal_status)} text-xs`}>
                      <Text className="text-xs">{getStatusLabel(item.meal_status)}</Text>
                    </Badge>
                  </View>
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-foreground">睡眠</Text>
                    <Badge className={`${getStatusBadge(item.sleep_status)} text-xs`}>
                      <Text className="text-xs">{getStatusLabel(item.sleep_status)}</Text>
                    </Badge>
                  </View>
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-foreground">情绪</Text>
                    <Badge className={`${getStatusBadge(item.mood_status)} text-xs`}>
                      <Text className="text-xs">{getStatusLabel(item.mood_status)}</Text>
                    </Badge>
                  </View>
                </View>
                {item.activities && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="block text-xs text-muted-foreground mb-1">今日活动</Text>
                    <Text className="block text-sm text-foreground">{item.activities}</Text>
                  </View>
                )}
                {item.notes && (
                  <View className="mt-2">
                    <Text className="block text-xs text-muted-foreground mb-1">老师备注</Text>
                    <Text className="block text-sm text-foreground">{item.notes}</Text>
                  </View>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
