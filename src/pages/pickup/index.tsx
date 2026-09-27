import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Network } from '@/network'
import { Bus } from 'lucide-react-taro'
import { formatTime } from '@/utils/format'
import { useShareMessage } from '@/hooks/useShare'

const COURSE_TYPE_COLORS: Record<string, string> = {
  全日托: 'bg-orange-50 text-orange-700 border-orange-200',
  半日托: 'bg-sky-50 text-sky-700 border-sky-200',
  周六托: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  晚间托: 'bg-purple-50 text-purple-700 border-purple-200',
  暑假班: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  寒假班: 'bg-amber-50 text-amber-700 border-amber-200',
  兴趣班: 'bg-pink-50 text-pink-700 border-pink-200',
}

const getCourseColor = (type?: string | null) =>
  COURSE_TYPE_COLORS[type || ''] || 'bg-cyan-50 text-cyan-700 border-cyan-200'

interface AttendanceRecord {
  id: string
  record_date: string
  status: string
  check_in_time: string | null
  check_out_time: string | null
  notes: string | null
  course_type?: string | null
}

export default function PickupPage() {
  useShareMessage()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [feeOpen, setFeeOpen] = useState(false)

  const childId = (() => {
    try {
      const raw = Taro.getCurrentInstance()?.router?.params?.child_id
      return raw ? decodeURIComponent(raw) : ''
    } catch {
      return ''
    }
  })()

  useDidShow(() => {
    loadRecords()
  })

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/parent/attendance',
        method: 'GET',
        data: { ...(childId ? { child_id: childId } : {}) },
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

  const getStatusBadge = (status: string, check_in_time: string | null, check_out_time: string | null) => {
    if (status === 'leave') return { label: '请假', className: 'bg-yellow-100 text-yellow-700' }
    if (status === 'absent') return { label: '缺席', className: 'bg-red-100 text-red-700' }
    if (check_out_time) return { label: '已离园', className: 'bg-gray-100 text-gray-700' }
    if (check_in_time) return { label: '已入园', className: 'bg-green-100 text-green-700' }
    return { label: '未记录', className: 'bg-gray-100 text-gray-500' }
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

      {records.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bus size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无接送记录</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {records.map((record) => {
            const badge = getStatusBadge(record.status, record.check_in_time, record.check_out_time)
            return (
              <Card key={record.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-2">
                      {record.course_type && (
                        <View className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${getCourseColor(record.course_type)}`}>
                          <Text className="text-xs">{record.course_type}</Text>
                        </View>
                      )}
                      <Text className="text-sm font-medium text-foreground">{record.record_date}</Text>
                    </View>
                    <Badge className={`${badge.className} text-xs`}>
                      <Text className="text-xs">{badge.label}</Text>
                    </Badge>
                  </View>
                  <View className="flex gap-6">
                    <View className="flex items-center gap-1">
                      <Text className="text-xs text-muted-foreground">入园时间</Text>
                      <Text className="text-sm text-foreground">{formatTime(record.check_in_time) || '—'}</Text>
                    </View>
                    <View className="flex items-center gap-1">
                      <Text className="text-xs text-muted-foreground">离园时间</Text>
                      <Text className="text-sm text-foreground">{formatTime(record.check_out_time) || '—'}</Text>
                    </View>
                  </View>
                  
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}

      {/* 延时托管服务费说明入口：常驻底部可见 */}
      <View className="flex justify-center py-6">
        <Text
          className="text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => setFeeOpen(true)}
        >
          延时托管服务费说明
        </Text>
      </View>

      <AlertDialog open={feeOpen} onOpenChange={setFeeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>延时托管服务费说明</AlertDialogTitle>
            <AlertDialogDescription>
              <Text className="block text-xs leading-relaxed">
                托育园早、晚延时托管服务相关收费说明：
              </Text>
              <Text className="block text-xs leading-relaxed">
                力高稚家托育开设早托、晚托延时托管服务，延时服务费 20 元 / 小时，不足 1 小时按 1 小时计费。
              </Text>
              <Text className="block text-xs leading-relaxed">✅ 早托时段：7:40-8:30</Text>
              <Text className="block text-xs leading-relaxed">✅ 晚托：16:45 开始计算</Text>
              <Text className="block text-xs leading-relaxed">
                ⚠️ 特别说明：若晚托超过 18:00，从 17:50 开始计算新一轮时长。
              </Text>
              <Text className="block text-xs leading-relaxed">
                晚托付费方式灵活，一次性缴费、周结、月结均可。
              </Text>
              <Text className="block text-xs leading-relaxed">
                延时托管收取的费用，主要用于支付延时时段在岗老师的加班薪酬，同时补贴园区延时开放产生的水电、保洁、物资耗材等额外运营成本。保教费仅覆盖正常保教时段服务，延时属于正常时间以外额外看护，需要专人值守，感谢各位家长理解与支持。
              </Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setFeeOpen(false)}>
              <Text className="text-sm">我知道了</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
