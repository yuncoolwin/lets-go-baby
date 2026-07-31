import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { Camera } from 'lucide-react-taro'

interface GrowthRecord {
  id: string
  record_type: string
  title: string
  content: string | null
  photo_urls: string[] | null
  created_at: string
  teacher_name: string
}

export default function GrowthPage() {
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/parent/growth-records',
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'milestone': return '里程碑'
      case 'photo': return '照片'
      case 'assessment': return '评估'
      default: return '记录'
    }
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'milestone': return 'bg-purple-100 text-purple-700'
      case 'photo': return 'bg-blue-100 text-blue-700'
      case 'assessment': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-40 w-full mb-3 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 mb-4">
        <View className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100" onClick={() => Taro.navigateBack()}>
          <Text className="block text-lg">←</Text>
        </View>
        <Text className="text-lg font-semibold text-foreground">成长档案</Text>
      </View>

      {records.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Camera size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无成长记录</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {records.map((record) => (
            <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <Badge className={`${getTypeBadgeClass(record.record_type)} text-xs`}>
                    <Text className="text-xs">{getTypeLabel(record.record_type)}</Text>
                  </Badge>
                  <Text className="text-xs text-muted-foreground">
                    {new Date(record.created_at).toLocaleDateString('zh-CN')}
                  </Text>
                </View>
                <Text className="block text-base font-semibold text-foreground mb-1">
                  {record.title}
                </Text>
                {record.content && (
                  <Text className="block text-sm text-muted-foreground mb-2">
                    {record.content}
                  </Text>
                )}
                {record.photo_urls && record.photo_urls.length > 0 && (
                  <View className="flex gap-2 mt-2 flex-wrap">
                    {record.photo_urls.map((url, idx) => (
                      <Image
                        key={idx}
                        src={url}
                        className="w-20 h-20 rounded-lg"
                        mode="aspectFill"
                      />
                    ))}
                  </View>
                )}
                <Text className="block text-xs text-muted-foreground mt-2">
                  — {record.teacher_name}
                </Text>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
