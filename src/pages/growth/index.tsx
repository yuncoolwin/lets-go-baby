import { useState } from 'react'
import { View, Text, Image, ScrollView, Video } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { refreshUnreadBadge, refreshGrowthUnreadBadge } from '@/utils/unread-badge'
import { Camera, Play } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
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

interface MediaItem {
  type: 'image' | 'video'
  url: string
  expired: boolean
}

export default function GrowthPage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const children = useAppStore((s) => s.children)
  const currentChildIndex = useAppStore((s) => s.currentChildIndex)
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [detailRecord, setDetailRecord] = useState<GrowthRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const [savingVideo, setSavingVideo] = useState(false)
  useDialogBack(detailOpen, () => setDetailOpen(false))

  useDidShow(() => {
    loadRecords()
    markGrowthRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // 页面下拉刷新
  usePullDownRefresh(() => {
    loadRecords()
    markGrowthRead()
    Taro.stopPullDownRefresh()
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

  // 合并图片与视频为统一媒体数组：图片在前、视频在后
  const buildMedia = (record: GrowthRecord): MediaItem[] => {
    const imgs = (record.photo_urls || []).map((url) => ({
      type: 'image' as const,
      url,
      expired: !!record.photo_expired,
    }))
    const vids = (record.video_urls || []).map((url) => ({
      type: 'video' as const,
      url,
      expired: !!record.video_expired,
    }))
    return [...imgs, ...vids]
  }

  const onMediaClick = (media: MediaItem) => {
    if (media.expired) return
    if (media.type === 'image') {
      previewImage([media.url], media.url)
    } else {
      setPlayerUrl(media.url)
    }
  }

  const closePlayer = () => {
    setPlayerUrl(null)
    setSavingVideo(false)
  }

  const saveVideo = async () => {
    if (!playerUrl || savingVideo) return
    setSavingVideo(true)
    try {
      try {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' })
      } catch (authErr) {
        console.error('[Growth] authorize album fail:', authErr)
      }
      const dl = await Network.downloadFile({ url: playerUrl })
      if (dl.statusCode !== 200) {
        Taro.showToast({ title: '视频下载失败', icon: 'none' })
        return
      }
      await Taro.saveVideoToPhotosAlbum({ filePath: dl.tempFilePath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err) {
      console.error('[Growth] save video fail:', err)
      Taro.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
    } finally {
      setSavingVideo(false)
    }
  }

  // 统一媒体缩略图区：同尺寸正方形，图片前、视频后，横向滑动浏览，过期显示灰色占位
  const renderMediaThumbs = (record: GrowthRecord) => {
    const media = buildMedia(record)
    if (media.length === 0) return null
    return (
      <ScrollView scrollX className="mt-3" style={{ width: '100%' }}>
        <View
          className="flex flex-row gap-2"
          style={{ display: 'inline-flex', flexDirection: 'row' }}
        >
          {media.map((m, idx) =>
            m.expired ? (
              <View
                key={idx}
                className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"
              >
                <Text className="block text-xs text-gray-400">已过期</Text>
              </View>
            ) : m.type === 'image' ? (
              <Image
                key={idx}
                src={m.url}
                className="w-24 h-24 rounded-lg flex-shrink-0"
                mode="aspectFill"
                onClick={() => onMediaClick(m)}
              />
            ) : (
              <View
                key={idx}
                className="w-24 h-24 rounded-lg bg-black flex items-center justify-center flex-shrink-0 overflow-hidden"
                onClick={() => onMediaClick(m)}
              >
                <Play size={28} color="#ffffff" />
              </View>
            ),
          )}
        </View>
      </ScrollView>
    )
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
                        const colorMap: Record<string, [string, string]> = {
                          总体评价: ['bg-blue-100', 'text-blue-700'],
                          餐食蔬菜: ['bg-green-100', 'text-green-700'],
                          餐食荤菜: ['bg-red-100', 'text-red-700'],
                          餐食汤: ['bg-amber-100', 'text-amber-700'],
                          日常喝水: ['bg-cyan-100', 'text-cyan-700'],
                          午睡: ['bg-purple-100', 'text-purple-700'],
                          大便: ['bg-rose-100', 'text-rose-700'],
                        }
                        const [bgCls, textCls] = colorMap[label] ?? ['bg-gray-100', 'text-gray-600']
                        return (
                          <View key={label} className={`px-2 py-1 rounded-md ${bgCls}`}>
                            <Text className={`text-xs ${textCls}`}>{label}：{value}</Text>
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

                {renderMediaThumbs(record)}

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
                {renderMediaThumbs(detailRecord)}
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
      {playerUrl && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <Video
            src={playerUrl}
            autoplay
            controls
            className="w-full rounded-xl bg-black"
            style={{ height: '50vh' }}
          />
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 16,
              marginTop: 28,
            }}
          >
            <Button size="sm" onClick={closePlayer}>
              缩小
            </Button>
            <Button
              size="sm"
              variant="default"
              loading={savingVideo}
              onClick={() => saveVideo()}
            >
              下载/保存
            </Button>
          </View>
        </View>
      )}
      <TabBar />
    </View>
  )
}