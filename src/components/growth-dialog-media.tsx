import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Play } from 'lucide-react-taro'

interface GrowthMediaRecord {
  photo_urls?: string[] | null
  video_urls?: string[] | null
  photo_expired?: boolean | null
  video_expired?: boolean | null
}

interface MediaItem {
  type: 'image' | 'video'
  url: string
  expired: boolean
}

interface GrowthDialogMediaProps {
  record: GrowthMediaRecord
  /** 点击视频时回调，打开全屏播放覆盖层 */
  onPlayVideo: (url: string) => void
}

/**
 * 成长档案详情弹窗内的大图/大视频媒体展示（与卡片缩略图区分）。
 * 图片用等比宽度大图（widthFix），视频用约 180px 高占位块，点击大图全屏预览、点击视频全屏播放。
 * 过期媒体显示同尺寸灰色占位块。
 */
export default function GrowthDialogMedia({ record, onPlayVideo }: GrowthDialogMediaProps) {
  const imgs: MediaItem[] = (record.photo_urls || []).map((url) => ({
    type: 'image',
    url,
    expired: !!record.photo_expired,
  }))
  const vids: MediaItem[] = (record.video_urls || []).map((url) => ({
    type: 'video',
    url,
    expired: !!record.video_expired,
  }))
  const media = [...imgs, ...vids]

  if (media.length === 0) return null

  return (
    <View className="space-y-3 mt-3">
      {media.map((m, idx) =>
        m.expired ? (
          <View
            key={idx}
            className="w-full h-44 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <Text className="block text-sm text-gray-400">已过期</Text>
          </View>
        ) : m.type === 'image' ? (
          <Image
            key={idx}
            src={m.url}
            mode="widthFix"
            className="w-full rounded-xl"
            onClick={() => Taro.previewImage({ urls: [m.url], current: m.url })}
          />
        ) : (
          <View
            key={idx}
            className="w-full h-44 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: '#FFF8F0' }}
            onClick={() => onPlayVideo(m.url)}
          >
            <Play size={48} color="#E8651A" />
          </View>
        ),
      )}
    </View>
  )
}