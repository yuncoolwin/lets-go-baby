import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store/app'
import { childrenApi, teacherApi, growthApi } from '@/utils/api'
import { X, ImagePlus } from 'lucide-react-taro'

const extractList = (res: any): any[] => {
  const data = res?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

export default function GrowthEditPage() {
  const currentRole = useAppStore((s) => s.currentRole)

  const [children, setChildren] = useState<any[]>([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [recordId, setRecordId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [childSearch, setChildSearch] = useState('')

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    if (params.id) {
      setRecordId(params.id)
      loadRecord(params.id)
    }
    if (params.child_id) setSelectedChildId(params.child_id)
    loadChildren()
  }, [])

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      let list = extractList(res)
      if (currentRole?.role_type === 'teacher' && currentRole?.id) {
        const meRes = await teacherApi.me(currentRole.id)
        const classId = meRes?.data?.class_id
        if (classId) list = list.filter((c) => c.class_id === classId)
      }
      setChildren(list)
    } catch (err) {
      console.error('[GrowthEdit] load children error:', err)
    }
  }

  const loadRecord = async (id: string) => {
    try {
      const res = await growthApi.detail(id, currentRole?.id)
      const data = res?.data
      if (data) {
        setTitle(data.title || '')
        setContent(data.content || '')
        setImages(data.photo_urls || [])
        setSelectedChildId(data.child_id || '')
      }
    } catch (err) {
      console.error('[GrowthEdit] load record error:', err)
    }
  }

  const readFileAsBase64 = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      Taro.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data as string),
        fail: reject,
      })
    })
  }

  const handleChooseImage = () => {
    const remain = 9 - images.length
    if (remain <= 0) return
    Taro.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = res.tempFilePaths || []
        if (!files.length) return
        setUploading(true)
        const urls: string[] = []
        for (const filePath of files) {
          try {
            const base64 = await readFileAsBase64(filePath)
            const upRes = await growthApi.uploadImage({
              image: base64,
              name: filePath.split('/').pop() || 'image.jpg',
            })
            const url = upRes?.data?.url
            if (url) urls.push(url)
          } catch (err) {
            console.error('[GrowthEdit] upload error:', err)
            Taro.showToast({ title: '图片上传失败', icon: 'none' })
          }
        }
        setImages((prev) => [...prev, ...urls])
        setUploading(false)
      },
    })
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!selectedChildId) {
      Taro.showToast({ title: '请选择幼儿', icon: 'none' })
      return
    }
    if (!title.trim()) {
      Taro.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      if (recordId) {
        await growthApi.update(
          recordId,
          { title: title.trim(), content: content.trim(), photo_urls: images },
          currentRole?.id,
        )
      } else {
        await growthApi.create(
          { child_id: selectedChildId, title: title.trim(), content: content.trim(), photo_urls: images },
          currentRole?.id,
        )
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (err) {
      console.error('[GrowthEdit] save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
    setSaving(false)
  }

  const selectedChild = children.find((c) => c.id === selectedChildId)
  const filteredChildren = children.filter((c) => (c.name || '').includes(childSearch.trim()))

  return (
    <View className="min-h-screen bg-background pb-28">
      <View className="p-4">
        <View className="mb-4">
          <Text className="block text-sm text-muted-foreground mb-2">选择幼儿</Text>
          <View
            className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between"
            onClick={() => setChildPickerOpen(true)}
          >
            <Text className="text-base text-foreground">
              {selectedChild ? selectedChild.name : '点击选择幼儿'}
            </Text>
            <Text className="text-sm text-muted-foreground">选择</Text>
          </View>
        </View>

        <View className="mb-4">
          <Text className="block text-sm text-muted-foreground mb-2">标题</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent"
              placeholder="请输入标题"
              value={title}
              onInput={(e) => setTitle(e.detail.value)}
              maxlength={50}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="block text-sm text-muted-foreground mb-2">正文</Text>
          <View className="bg-gray-50 rounded-2xl p-4">
            <Textarea
              style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
              placeholder="请输入记录内容..."
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              maxlength={500}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="block text-sm text-muted-foreground mb-2">图片（最多 9 张）</Text>
          <View className="flex flex-wrap gap-3">
            {images.map((url, idx) => (
              <View key={idx} className="relative">
                <Image src={url} className="w-24 h-24 rounded-lg" mode="aspectFill" />
                <View
                  className="absolute -top-2 -right-2 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center"
                  onClick={() => removeImage(idx)}
                >
                  <X size={14} color="#fff" />
                </View>
              </View>
            ))}
            {images.length < 9 && (
              <View
                className="w-24 h-24 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center"
                onClick={handleChooseImage}
              >
                <ImagePlus size={22} color="#999" />
                <Text className="block text-xs text-gray-400 mt-1">
                  {uploading ? '上传中' : '添加图片'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

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
        }}
      >
        <Button className="w-full" onClick={handleSave} disabled={saving || uploading}>
          <Text className="text-white">{saving ? '保存中...' : '保存'}</Text>
        </Button>
      </View>

      <Dialog open={childPickerOpen} onOpenChange={setChildPickerOpen}>
        <DialogContent
          className="bg-white rounded-2xl p-6 max-w-sm mx-auto"
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">选择幼儿</Text>
            </DialogTitle>
          </DialogHeader>
          <View className="bg-gray-50 rounded-xl px-4 py-2 mb-3">
            <Input
              className="w-full bg-transparent"
              placeholder="搜索幼儿姓名"
              value={childSearch}
              onInput={(e) => setChildSearch(e.detail.value)}
            />
          </View>
          <View className="flex flex-wrap gap-2">
            {filteredChildren.map((c) => (
              <Badge
                key={c.id}
                className={selectedChildId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}
                onClick={() => {
                  setSelectedChildId(c.id)
                  setChildPickerOpen(false)
                }}
              >
                <Text className="text-sm">{c.name}</Text>
              </Badge>
            ))}
            {filteredChildren.length === 0 && (
              <Text className="block text-sm text-muted-foreground py-4">未找到匹配幼儿</Text>
            )}
          </View>
          <Button className="w-full mt-4" onClick={() => setChildPickerOpen(false)}>
            <Text className="text-white">确定</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </View>
  )
}