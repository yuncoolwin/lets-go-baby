import { useState, useEffect } from 'react'
import { View, Text, Image, Video, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { growthApi } from '@/utils/api'
import { isH5 } from '@/lib/platform'
import { ImagePlus, Video as VideoIcon, Trash2, Check, Archive } from 'lucide-react-taro'

interface LibraryItem {
  id: string
  media_type: 'image' | 'video'
  url: string | null
  unavailable: boolean
  uploader_id: string
  can_delete: boolean
  created_at: string
}

const readFileAsBase64 = (filePath: string, fileObj?: File): Promise<string> => {
  if (isH5()) {
    const readBlob = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1] || ''
          const type = fileObj?.type || (result.startsWith('data:') ? result.slice(5, result.indexOf(';')) : '') || 'image/png'
          resolve(`data:${type};base64,${base64}`)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
    if (fileObj) return readBlob(fileObj)
    return fetch(filePath).then((r) => r.blob()).then(readBlob)
  }
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (r) => {
        const ext = (filePath.split('.').pop() || 'png').toLowerCase()
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'webp' ? 'webp' : 'png'
        resolve(`data:image/${mime};base64,${r.data}`)
      },
      fail: reject,
    })
  })
}

const parseEmbeddedMsg = (errMsg: string): string => {
  try {
    const m = errMsg.match(/\{[\s\S]*\}/)
    if (m) {
      const obj = JSON.parse(m[0])
      if (obj && obj.msg) return String(obj.msg)
    }
  } catch (e) {
    // ignore
  }
  return errMsg || ''
}

export default function GrowthMediaLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<'none' | 'image' | 'video'>('none')
  const [activeType, setActiveType] = useState<'all' | 'image' | 'video'>('all')

  // 选择模式（从成长档案页进入）
  const [selectMode, setSelectMode] = useState(false)
  const [selMediaType, setSelMediaType] = useState<'image' | 'video'>('image')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const source = params.source || ''
    const mediaType = params.mediaType || ''
    setSelectMode(source === 'edit')
    if (mediaType === 'image' || mediaType === 'video') {
      setSelMediaType(mediaType)
      setActiveType(mediaType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useDidShow(() => {
    loadList(1, true)
  })

  const loadList = async (targetPage: number, reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await growthApi.libraryList({ page: targetPage, page_size: 20 })
      const data = res?.data || {}
      const list: LibraryItem[] = Array.isArray(data.list) ? data.list : []
      setItems((prev) => (reset ? list : [...prev, ...list]))
      setTotal(data.total ?? 0)
      setPage(targetPage)
    } catch (err) {
      console.error('[GrowthLibrary] load error:', err)
      Taro.showToast({ title: '素材加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    const visible = visibleItems().length
    if (visible >= total) return
    loadList(page + 1)
  }

  const activeItems = () => {
    const filtered = activeType === 'all' ? items : items.filter((it) => it.media_type === activeType)
    return filtered
  }
  const visibleItems = () => activeItems()

  const refresh = () => {
    loadList(1, true)
    setSelected([])
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const formatTime = (t?: string) => {
    if (!t) return ''
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const paths = res.tempFilePaths || []
        const tempFiles = res.tempFiles || []
        setUploading('image')
        for (let i = 0; i < paths.length; i++) {
          try {
            const fileObj = tempFiles[i]?.originalFileObj
            const base64 = await readFileAsBase64(paths[i], fileObj)
            const upload = await growthApi.libraryUploadImage({ image: base64, name: 'library.jpg' })
            if (upload?.data?.media) {
              Taro.showToast({ title: '上传成功', icon: 'success' })
              refresh()
            } else {
              Taro.showToast({ title: upload?.msg || '图片上传失败', icon: 'none' })
            }
          } catch (err) {
            console.error('[GrowthLibrary] upload image error:', err)
            Taro.showToast({ title: '图片上传失败', icon: 'none' })
          }
        }
        setUploading('none')
      },
      fail: (err) => {
        const msg = String((err as any)?.errMsg || (err as any)?.message || '')
        if (msg.includes('privacy permission is not authorized')) {
          Taro.showToast({ title: '请在微信后台配置相册/摄像头隐私声明', icon: 'none', duration: 2500 })
        } else if (msg.includes('cancel')) {
          Taro.showToast({ title: '已取消选择', icon: 'none' })
        } else {
          Taro.showToast({ title: msg || '选择图片失败', icon: 'none' })
        }
      },
    })
  }

  const handleChooseVideo = () => {
    Taro.chooseVideo({
      compressed: false,
      maxDuration: 60,
      sourceType: ['album', 'camera'],
      success: async (res) => {
        let tempFilePath = res.tempFilePath
        let size: number = res.size || 0
        setUploading('video')
        try {
          const qualities: { bitrate: number; resolution: number }[] = [
            { bitrate: 5000, resolution: 0.9 },
            { bitrate: 3500, resolution: 0.7 },
            { bitrate: 2000, resolution: 0.5 },
          ]
          for (const item of qualities) {
            if (size <= 50 * 1024 * 1024) break
            try {
              const compressed = await (Taro.compressVideo as (
                opts: { src: string; bitrate: number; fps: number; resolution: number },
              ) => Promise<{ tempFilePath: string; size?: number }>)({
                src: tempFilePath,
                bitrate: item.bitrate,
                fps: 24,
                resolution: item.resolution,
              })
              tempFilePath = compressed.tempFilePath
              size = compressed.size ? compressed.size * 1024 : size
            } catch (e) {
              console.warn('[GrowthLibrary] compress error:', e)
              break
            }
          }
          if (size > 50 * 1024 * 1024) {
            Taro.showToast({ title: '视频过大，请控制在50MB以内', icon: 'none' })
            return
          }
          const upload = await growthApi.libraryUploadVideo(tempFilePath)
          if (upload?.data?.media) {
            Taro.showToast({ title: '上传成功', icon: 'success' })
            refresh()
          } else {
            Taro.showToast({ title: upload?.msg || '视频上传失败', icon: 'none', duration: 2500 })
          }
        } catch (err) {
          console.error('[GrowthLibrary] upload video error:', JSON.stringify(err))
          const e = (err ?? {}) as Record<string, any>
          const body = e?.data ?? e?.response?.data ?? null
          let reason = ''
          if (body && typeof body === 'object' && (body.msg || body.message)) {
            reason = String(body.msg || body.message || '')
          } else {
            reason = String((e?.msg || '') || (e?.message || '') || (typeof e?.errMsg === 'string' ? parseEmbeddedMsg(e.errMsg) : ''))
          }
          Taro.showToast({ title: (reason && String(reason).slice(0, 40)) || '视频上传失败', icon: 'none', duration: 2500 })
        } finally {
          setUploading('none')
        }
      },
      fail: (err) => {
        const msg = String((err as any)?.errMsg || (err as any)?.message || '')
        if (msg.includes('privacy permission is not authorized')) {
          Taro.showToast({ title: '请在微信后台配置相册/摄像头隐私声明', icon: 'none', duration: 2500 })
        } else if (msg.includes('cancel')) {
          Taro.showToast({ title: '已取消选择', icon: 'none' })
        } else {
          Taro.showToast({ title: msg || '选择视频失败', icon: 'none' })
        }
      },
    })
  }

  const handleDelete = (item: LibraryItem) => {
    Taro.showModal({
      title: '删除素材',
      content: '删除后该素材将无法在编辑页复用，确定删除？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const del = await growthApi.libraryDelete(item.id)
          if ((del as any)?.code === 200 || (del as any)?.msg === 'success') {
            Taro.showToast({ title: '已删除', icon: 'success' })
            refresh()
          } else {
            Taro.showToast({ title: (del as any)?.msg || '删除失败', icon: 'none' })
          }
        } catch (err) {
          console.error('[GrowthLibrary] delete error:', err)
          Taro.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  }

  const handleConfirm = () => {
    const selectedItems = items.filter((it) => selected.includes(it.id) && !it.unavailable)
    const urls = selectedItems.map((it) => it.url).filter((u): u is string => !!u)
    Taro.eventCenter.trigger('GROWTH_LIBRARY_SELECT', { mediaType: selMediaType, urls })
    Taro.showToast({ title: `已选用 ${urls.length} 个素材`, icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 300)
  }

  const list = activeItems()

  return (
    <View className="min-h-screen bg-background">
      {/* 顶栏 */}
      <View className="flex items-center justify-between px-4 pt-4 pb-2">
        <View className="flex-1">
          <Text className="block text-lg font-bold text-foreground">素材箱</Text>
          {!selectMode && <Text className="block text-xs text-muted-foreground mt-1">共 {total} 个素材 · 图片视频通用</Text>}
          {selectMode && (
            <Text className="block text-xs text-muted-foreground mt-1">
              选择{selMediaType === 'image' ? '图片' : '视频'}素材（已选 {selected.length}）
            </Text>
          )}
        </View>
        {selectMode && (
          <Button size="sm" variant="ghost" onClick={() => Taro.navigateBack()}>
            <Text className="text-muted-foreground">取消</Text>
          </Button>
        )}
      </View>

      {/* 类型切换 + 上传入口（非选择模式） */}
      {!selectMode && (
        <View className="px-4 pb-2">
          <View className="flex items-center gap-2 mb-3">
            <View
              className={`px-3 py-1 rounded-full ${activeType === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setActiveType('all')}
            >
              <Text className="block text-xs">全部</Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${activeType === 'image' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setActiveType('image')}
            >
              <Text className="block text-xs">图片</Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${activeType === 'video' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setActiveType('video')}
            >
              <Text className="block text-xs">视频</Text>
            </View>
          </View>
          <View className="flex gap-2">
            <View style={{ flex: 1 }} onClick={handleChooseImage}>
              <Button size="sm" className="w-full" disabled={uploading === 'image'}>
                <ImagePlus size={16} color="#fff" />
                <Text className="ml-1 text-white">{uploading === 'image' ? '上传中...' : '上传图片'}</Text>
              </Button>
            </View>
            <View style={{ flex: 1 }} onClick={handleChooseVideo}>
              <Button size="sm" variant="secondary" className="w-full" disabled={uploading === 'video'}>
                <VideoIcon size={16} color="#111827" />
                <Text className="ml-1">{uploading === 'video' ? '上传中...' : '上传视频'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 列表 */}
      <ScrollView
        scrollY
        style={{ height: selectMode ? `calc(100vh - 140px)` : `calc(100vh - 190px)` }}
        onScrollToLower={loadMore}
      >
        <View className="px-4">
          {loading && list.length === 0 && (
            <View className="flex items-center justify-center py-20">
              <Text className="block text-sm text-muted-foreground">加载中...</Text>
            </View>
          )}

          {!loading && list.length === 0 && (
            <View className="flex flex-col items-center justify-center py-20">
              <Archive size={40} color="#d1d5db" />
              <Text className="block text-sm text-muted-foreground mt-3">
                {selectMode ? `暂无可用${selMediaType === 'image' ? '图片' : '视频'}素材` : '素材箱空空如也'}
              </Text>
              {selectMode && (
                <Text className="block text-xs text-gray-400 mt-1">可返回素材箱主页后上传再使用</Text>
              )}
            </View>
          )}

          <View className="flex flex-wrap gap-2 pb-40">
            {list.map((item) => {
              const checked = selected.includes(item.id)
              const disabled = item.unavailable || !item.url
              return (
                <Card
                  key={item.id}
                  className={`relative overflow-hidden ${selectMode ? 'w-28' : item.media_type === 'video' ? 'w-full' : 'w-28'}`}
                >
                  <View className="relative" onClick={() => selectMode && !disabled && toggleSelect(item.id)}>
                    {item.media_type === 'image' ? (
                      <Image
                        src={item.url || ''}
                        mode="aspectFill"
                        className={`w-full ${selectMode ? 'h-28' : 'h-28'} rounded-lg`}
                      />
                    ) : (
                      <Video
                        src={item.url || ''}
                        controls
                        className="w-full h-28 rounded-lg bg-black"
                      />
                    )}

                    {item.unavailable && (
                      <View className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
                        <Text className="block text-xs text-gray-400">素材已失效</Text>
                      </View>
                    )}

                    {/* 选择态勾选标记 */}
                    {selectMode && !disabled && checked && (
                      <View className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} color="#fff" />
                      </View>
                    )}

                    {/* 时间 */}
                    <Text className="block text-xs text-gray-500 mt-1">
                      {formatTime(item.created_at)}
                    </Text>
                  </View>

                  {/* 删除（非选择模式，按权限） */}
                  {!selectMode && item.can_delete && (
                    <View
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black bg-opacity-60 flex items-center justify-center"
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 size={12} color="#fff" />
                    </View>
                  )}
                </Card>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* 选择模式底部确认栏 */}
      {selectMode && (
        <View
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text className="block text-sm text-muted-foreground">已选 {selected.length} 个素材</Text>
          </View>
          <Button className="w-32" disabled={selected.length === 0} onClick={handleConfirm}>
            <Text className="text-white">确定使用</Text>
          </Button>
        </View>
      )}
    </View>
  )
}