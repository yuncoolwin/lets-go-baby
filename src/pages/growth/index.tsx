import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { refreshUnreadBadge } from '@/utils/unread-badge'
import { Camera } from 'lucide-react-taro'
import TabBar from '@/components/tab-bar'

interface GrowthRecord {
  id: string
  record_type: string
  title: string
  content: string | null
  photo_urls: string[] | null
  created_at: string
  teacher_name: string
  course_name?: string
  parent_read_at?: string | null
}

export default function GrowthPage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    loadRecords()
    markGrowthRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const loadRecords = async () => {
    if (!currentRole?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/parent/growth-records?parent_role_id=${currentRole.id}`,
        method: 'GET',
      })
      console.log('[Growth] records:', res.data)
      if (res.data?.data) {
        setRecords(res.data.data)
      }
    } catch (err) {
      console.error('[Growth] error:', err)
    }
    setLoading(false)
  }

  const markGrowthRead = async () => {
    if (!currentRole?.id) return
    try {
      await Network.request({
        url: '/api/parent/growth-records/read',
        method: 'POST',
        data: { parent_role_id: currentRole.id },
      })
      refreshUnreadBadge(currentRole.id)
    } catch (err) {
      console.error('[Growth] mark read error:', err)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }

  const previewImage = (urls: string[], current: string) => {
    Taro.previewImage({ urls, current })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4 pb-24">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-40 w-full mb-3 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <TabBar />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      {records.length === 0 ? (
        <View className="flex flex-col items-center py-20">
          <Camera size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无成长记录</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {records.map((record) => (
            <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-2">
                    {record.course_name ? (
                      <Badge className="bg-orange-100 text-orange-700 text-xs">
                        <Text className="text-xs">{record.course_name}</Text>
                      </Badge>
                    ) : null}
                    {!record.parent_read_at && (
                      <View className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </View>
                  <Text className="text-xs text-muted-foreground">{formatDate(record.created_at)}</Text>
                </View>

                <Text className="block text-base font-semibold text-foreground mb-1">{record.title}</Text>

                {record.content && (
                  <Text className="block text-sm text-muted-foreground">{record.content}</Text>
                )}

                {record.photo_urls && record.photo_urls.length > 0 && (
                  <View className="flex flex-wrap gap-2 mt-3">
                    {record.photo_urls.map((url, idx) => (
                      <Image
                        key={idx}
                        src={url}
                        className="w-24 h-24 rounded-lg"
                        mode="aspectFill"
                        onClick={() => previewImage(record.photo_urls as string[], url)}
                      />
                    ))}
                  </View>
                )}

                <View className="flex justify-end mt-3">
                  <Text className="text-xs text-muted-foreground">
                    {record.teacher_name || '老师'}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
      <TabBar />
    </View>
  )
}