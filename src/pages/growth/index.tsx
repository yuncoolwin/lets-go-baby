import { useState } from 'react'
import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { refreshUnreadBadge, refreshGrowthUnreadBadge } from '@/utils/unread-badge'
import { Camera } from 'lucide-react-taro'
import TabBar from '@/components/tab-bar'
import { useDialogBack } from '@/utils/use-dialog-back'

interface GrowthRecord {
  id: string
  record_type: string
  title: string
  content: string | null
  photo_urls: string[] | null
  video_urls: string[] | null
  photo_expired?: boolean
  video_expired?: boolean
  created_at: string
  teacher_name: string
  course_name?: string
  parent_read_at?: string | null
  record_date?: string
  diet_overall?: string | null
  diet_vegetable?: string | null
  diet_meat?: string | null
  diet_soup?: string | null
  diet_water?: string | null
  nap_status?: string | null
  stool_status?: string | null
}

export default function GrowthPage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const children = useAppStore((s) => s.children)
  const currentChildIndex = useAppStore((s) => s.currentChildIndex)
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [detailRecord, setDetailRecord] = useState<GrowthRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  useDialogBack(detailOpen, () => setDetailOpen(false))

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
      const currentChild = children[currentChildIndex]
      const childId = currentChild?.id || currentChild?.child_id
      const childQuery = childId ? `&child_id=${encodeURIComponent(childId)}` : ''
      const res = await Network.request({
        url: `/api/parent/growth-records?parent_role_id=${currentRole.id}${childQuery}`,
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
    const currentChild = children[currentChildIndex]
    const childId = currentChild?.id || currentChild?.child_id
    try {
      await Network.request({
        url: childId
          ? `/api/parent/growth-records/read?child_id=${encodeURIComponent(childId)}`
          : '/api/parent/growth-records/read',
        method: 'POST',
      })
      refreshUnreadBadge(currentRole.id)
      refreshGrowthUnreadBadge(currentRole.id, childId || undefined)
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
          <Text className="block text-sm text-muted-foreground mt-3">暂无成长档案</Text>
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
                    <Text className="block text-base font-semibold text-foreground">{record.title}</Text>
                    {!record.parent_read_at && (
                      <View className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </View>
                  <Text className="text-xs text-muted-foreground">{formatDate(record.created_at)}</Text>
                </View>

                <View
                  onClick={() => {
                    setDetailRecord(record)
                    setDetailOpen(true)
                  }}
                >
                  {[
                    ['总体评价', record.diet_overall],
                    ['餐食蔬菜', record.diet_vegetable],
                    ['餐食荤菜', record.diet_meat],
                    ['餐食汤', record.diet_soup],
                    ['日常喝水', record.diet_water],
                    ['午睡', record.nap_status],
                    ['大便', record.stool_status],
                  ].some(([, v]) => !!v) && (
                    <View className="flex flex-wrap gap-2 mt-2 ml-2">
                      {([
                        ['总体评价', record.diet_overall],
                        ['餐食蔬菜', record.diet_vegetable],
                        ['餐食荤菜', record.diet_meat],
                        ['餐食汤', record.diet_soup],
                        ['日常喝水', record.diet_water],
                        ['午睡', record.nap_status],
                        ['大便', record.stool_status],
                      ] as [string, string][]).filter(([, v]) => !!v).map(([label, value]) => {
                        return (
                          <View key={label} className="px-2 py-1 rounded-full bg-blue-50">
                            <Text className="text-xs text-blue-600">{label}：{value}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                  {record.content && (
                    <Text
                      className="block text-sm text-muted-foreground"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {record.content}
                    </Text>
                  )}
                </View>

                {record.photo_urls && record.photo_urls.length > 0 && !record.photo_expired && (
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
                {record.photo_urls && record.photo_urls.length > 0 && record.photo_expired && (
                  <View className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center mt-3">
                    <Text className="block text-xs text-gray-400">照片已过期</Text>
                  </View>
                )}

                {record.video_urls && record.video_urls.length > 0 && !record.video_expired && (
                  <View className="space-y-2 mt-3">
                    {record.video_urls.map((url, idx) => (
                      <Video key={idx} src={url} controls className="w-full rounded-lg bg-black" style={{ height: '180px' }} />
                    ))}
                  </View>
                )}
                {record.video_urls && record.video_urls.length > 0 && record.video_expired && (
                  <View className="space-y-2 mt-3">
                    <View className="w-full rounded-lg bg-gray-100 flex items-center justify-center" style={{ height: '120px' }}>
                      <Text className="block text-xs text-gray-400">视频已过期</Text>
                    </View>
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
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '85vh' }}>
          <DialogHeader>
            <DialogTitle>
              <View className="flex items-center gap-2 flex-wrap pr-10">
                {detailRecord?.course_name && (
                  <Badge className="bg-orange-100 text-orange-700 text-xs">
                    <Text className="text-xs">{detailRecord.course_name}</Text>
                  </Badge>
                )}
                <Text className="text-lg font-semibold text-foreground">{detailRecord?.title || '成长档案'}</Text>
              </View>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="mt-4" style={{ maxHeight: '60vh' }}>
            {detailRecord && (
              <View className="space-y-3">
                <Text className="block text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailRecord.content}
                </Text>
                {detailRecord.photo_urls && detailRecord.photo_urls.length > 0 && !detailRecord.photo_expired && (
                  <View className="space-y-2">
                    {detailRecord.photo_urls.map((url, idx) => (
                      <Image key={idx} src={url} className="w-full rounded-lg" mode="widthFix" onClick={() => previewImage(detailRecord.photo_urls as string[], url)} />
                    ))}
                  </View>
                )}
                {detailRecord.photo_urls && detailRecord.photo_urls.length > 0 && detailRecord.photo_expired && (
                  <View className="w-full rounded-lg bg-gray-100 flex items-center justify-center" style={{ height: '140px' }}>
                    <Text className="block text-xs text-gray-400">照片已过期</Text>
                  </View>
                )}
                {detailRecord.video_urls && detailRecord.video_urls.length > 0 && !detailRecord.video_expired && (
                  <View className="space-y-2">
                    {detailRecord.video_urls.map((url, idx) => (
                      <Video key={idx} src={url} controls className="w-full rounded-lg bg-black" style={{ height: '180px' }} />
                    ))}
                  </View>
                )}
                {detailRecord.video_urls && detailRecord.video_urls.length > 0 && detailRecord.video_expired && (
                  <View className="w-full rounded-lg bg-gray-100 flex items-center justify-center" style={{ height: '140px' }}>
                    <Text className="block text-xs text-gray-400">视频已过期</Text>
                  </View>
                )}
                <View className="flex justify-end pt-3">
                  <View className="text-right space-y-1">
                    <Text className="block text-xs text-muted-foreground">
                      {detailRecord.teacher_name || '老师'}
                    </Text>
                    <Text className="block text-xs text-muted-foreground">
                      {detailRecord.record_date || formatDate(detailRecord.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>
      <TabBar />
    </View>
  )
}