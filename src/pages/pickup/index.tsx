import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { Bus } from 'lucide-react-taro'
import BackButton from '@/components/back-button'

interface AttendanceRecord {
  id: string
  record_date: string
  status: string
  check_in_time: string | null
  check_out_time: string | null
  notes: string | null
}

export default function PickupPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/parent/attendance',
        method: 'GET',
      })
      console.log('[Pickup] records:', res.data)
      if (res.data?.data) {
        setRecords(res.data.data)
      }
    } catch (err) {
      console.error('[Pickup] error:', err)
    }
    setLoading(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return { label: '已入园', className: 'bg-green-100 text-green-700' }
      case 'absent': return { label: '未入园', className: 'bg-red-100 text-red-700' }
      case 'leave': return { label: '请假', className: 'bg-yellow-100 text-yellow-700' }
      default: return { label: '未知', className: 'bg-gray-100 text-gray-700' }
    }
  }

  const formatTime = (time: string | null) => {
    if (!time) return '—'
    return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-20 w-full mb-3 rounded-xl" />
        <Skeleton className="h-20 w-full mb-3 rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <BackButton title="接送记录" />

      {records.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bus size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无接送记录</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {records.map((record) => {
            const badge = getStatusBadge(record.status)
            return (
              <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-foreground">{record.record_date}</Text>
                    <Badge className={`${badge.className} text-xs`}>
                      <Text className="text-xs">{badge.label}</Text>
                    </Badge>
                  </View>
                  <View className="flex gap-6">
                    <View>
                      <Text className="block text-xs text-muted-foreground">入园时间</Text>
                      <Text className="block text-sm text-foreground">{formatTime(record.check_in_time)}</Text>
                    </View>
                    <View>
                      <Text className="block text-xs text-muted-foreground">离园时间</Text>
                      <Text className="block text-sm text-foreground">{formatTime(record.check_out_time)}</Text>
                    </View>
                  </View>
                  {record.notes && (
                    <Text className="block text-xs text-muted-foreground mt-2">备注: {record.notes}</Text>
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
