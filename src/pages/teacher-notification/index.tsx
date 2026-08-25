import { useState, useEffect, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { notificationApi, classApi, childrenApi, teacherApi, courseApi } from '@/utils/api'
import { useAppStore } from '@/store/app'
import { Send, Save, Inbox, Users, User, Bell, BookOpen, Megaphone, ChevronRight } from 'lucide-react-taro'

type NotificationType = 'all' | 'course' | 'class' | 'personal' | 'teacher'

interface TargetOption {
  id: string
  label: string
}

interface DraftItem {
  id: string
  title: string
  content: string
  type: string
  target_ids: string[]
  images?: string[]
  created_at: string
}

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'all', label: '全园通知' },
  { value: 'course', label: '课程通知' },
  { value: 'class', label: '班级通知' },
  { value: 'personal', label: '个人通知' },
  { value: 'teacher', label: '教师通知' },
]

const TYPE_ICONS: Record<NotificationType, any> = {
  all: Megaphone,
  course: BookOpen,
  class: Users,
  personal: User,
  teacher: Bell,
}

const TYPE_LABEL: Record<NotificationType, string> = {
  all: '全园',
  course: '课程',
  class: '班级',
  personal: '幼儿',
  teacher: '教师',
}

// 教师端可发的通知类型（全园/教师仅管理员可发，后端有 403 兜底）
const TEACHER_ALLOWED_TYPES: NotificationType[] = ['course', 'class', 'personal']

const extractList = (res: any): any[] => {
  const data = res?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TeacherNotificationPage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const isAdmin = currentRole?.role_type === 'admin' || currentRole?.role_type === 'superadmin'

  const visibleTypeOptions = isAdmin
    ? TYPE_OPTIONS
    : TYPE_OPTIONS.filter((opt) => TEACHER_ALLOWED_TYPES.includes(opt.value))

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<NotificationType>('class')
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [classList, setClassList] = useState<any[]>([])
  const [courseList, setCourseList] = useState<any[]>([])
  const [childrenList, setChildrenList] = useState<any[]>([])
  const [teacherList, setTeacherList] = useState<any[]>([])

  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftList, setDraftList] = useState<DraftItem[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [childSearch, setChildSearch] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      loadClasses()
      loadCourses()
      loadChildren()
      if (isAdmin) loadTeachers()
      isFirstRender.current = false
    }
  }, [])

  // 从其他页面返回时刷新数据
  useDidShow(() => {
    if (!isFirstRender.current) {
      loadClasses()
      loadCourses()
      loadChildren()
      if (isAdmin) loadTeachers()
    }
  })

  const loadClasses = async () => {
    try {
      const res = await classApi.list()
      const list = extractList(res)
      setClassList(list.filter((c: any) => c.status === 'active'))
    } catch (err) {
      console.error('[TeacherNotification] loadClasses error:', err)
    }
  }

  const loadCourses = async () => {
    try {
      const res = await courseApi.list()
      setCourseList(extractList(res))
    } catch (err) {
      console.error('[TeacherNotification] loadCourses error:', err)
    }
  }

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      setChildrenList(extractList(res))
    } catch (err) {
      console.error('[TeacherNotification] loadChildren error:', err)
    }
  }

  const loadTeachers = async () => {
    try {
      const res = await teacherApi.list()
      setTeacherList(extractList(res))
    } catch (err) {
      console.error('[TeacherNotification] loadTeachers error:', err)
    }
  }

  const loadDrafts = async () => {
    setDraftLoading(true)
    try {
      const res = await notificationApi.list({ scope: 'draft', author_id: currentRole?.id })
      setDraftList(extractList(res))
    } catch (err) {
      console.error('[TeacherNotification] loadDrafts error:', err)
      Taro.showToast({ title: '草稿加载失败', icon: 'none' })
    } finally {
      setDraftLoading(false)
    }
  }

  const getTargetOptions = (): TargetOption[] => {
    switch (type) {
      case 'course':
        return courseList.map((c) => ({ id: c.id, label: c.name || '未命名课程' }))
      case 'class':
        return classList.map((c) => ({ id: c.id, label: c.name || '未命名班级' }))
      case 'personal':
        return childrenList.map((c) => ({
          id: c.id,
          label: c.name,
        }))
      case 'teacher':
        return teacherList.map((t) => ({ id: t.id, label: t.real_name || t.nickname || t.name || '未命名教师' }))
      default:
        return []
    }
  }

  const handleTypeChange = (val: NotificationType) => {
    setType(val)
    setSelectedTargetIds([])
  }

  const handleToggle = (id: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleEditDraft = (draft: DraftItem) => {
    setTitle(draft.title || '')
    setContent(draft.content || '')
    setType((draft.type as NotificationType) || 'class')
    setSelectedTargetIds(Array.isArray(draft.target_ids) ? draft.target_ids : [])
    setImages(Array.isArray(draft.images) ? draft.images : [])
    setDraftId(draft.id)
    setDraftOpen(false)
  }

  const handleDeleteDraft = async (id: string) => {
    try {
      const res = await notificationApi.remove(id)
      if (res?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        loadDrafts()
      } else {
        Taro.showToast({ title: res?.msg || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[TeacherNotification] delete draft error:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const handleChooseImage = async () => {
    if (images.length >= 9) {
      Taro.showToast({ title: '最多添加 9 张图片', icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: 9 - images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const tempFilePaths = res?.tempFilePaths || []
      if (!tempFilePaths.length) return

      setUploadingImage(true)
      const uploadedUrls: string[] = []
      for (const filePath of tempFilePaths) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            Taro.getFileSystemManager().readFile({
              filePath,
              encoding: 'base64',
              success: (r) => resolve(r.data as string),
              fail: reject,
            })
          })
          const name = filePath.split('/').pop() || 'image.png'
          const upRes = await notificationApi.uploadImage({ image: base64, name })
          const url = upRes?.data?.url
          if (url) uploadedUrls.push(url)
        } catch (err) {
          console.error('[TeacherNotification] upload image error:', err)
        }
      }
      setUploadingImage(false)
      if (uploadedUrls.length) {
        setImages((prev) => [...prev, ...uploadedUrls].slice(0, 9))
        Taro.showToast({ title: `已添加 ${uploadedUrls.length} 张图片`, icon: 'success' })
      } else {
        Taro.showToast({ title: '图片上传失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[TeacherNotification] chooseImage error:', err)
      setUploadingImage(false)
      Taro.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入通知标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入通知内容', icon: 'none' })
      return
    }
    if (type !== 'all' && selectedTargetIds.length === 0) {
      Taro.showToast({ title: `请选择至少一个${TYPE_LABEL[type]}`, icon: 'none' })
      return
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      type,
      target_ids: type === 'all' ? [] : selectedTargetIds,
      status,
      images,
    }

    setSubmitting(true)
    try {
      let res: any
      if (draftId) {
        res = await notificationApi.update(draftId, payload)
      } else {
        res = await notificationApi.create(payload, currentRole?.id)
      }
      console.log('[TeacherNotification] submit response:', res)

      if (res?.code === 200) {
        if (status === 'draft') {
          // 新建草稿后记录 id，后续保存走 update
          if (!draftId && res.data?.id) setDraftId(res.data.id)
          Taro.showToast({ title: '已保存到草稿箱', icon: 'success' })
        } else {
          Taro.showToast({ title: '发布成功', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        }
      } else {
        Taro.showToast({ title: res?.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[TeacherNotification] submit error:', err)
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const targetOptions = getTargetOptions()

  return (
    <View className="min-h-screen bg-background p-4 pb-28">
      {/* 顶部：标题 + 草稿箱 */}
      <View className="flex items-center justify-between mb-4">
        <View className="flex-1">
          <Text className="block text-lg font-bold text-foreground">发布通知</Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {isAdmin ? '向全园、课程、班级、个人或教师发送通知' : '向家长发送通知'}
          </Text>
        </View>
        <View
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-sm"
          onClick={() => {
            setDraftOpen(true)
            loadDrafts()
          }}
        >
          <Inbox size={16} color="#E8651A" />
          <Text className="text-sm text-foreground">草稿箱</Text>
        </View>
      </View>

      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4 space-y-4">
          {/* 通知类型 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知类型</Text>
            </Label>
            <View className="flex flex-wrap gap-2 mt-2">
              {visibleTypeOptions.map((opt) => {
                const Icon = TYPE_ICONS[opt.value]
                const active = type === opt.value
                return (
                  <View
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                      active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => handleTypeChange(opt.value)}
                  >
                    <Icon size={14} color={active ? '#ffffff' : '#666666'} />
                    <Text className={`text-sm ${active ? 'text-white' : 'text-gray-600'}`}>
                      {opt.label}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* 通知对象（全园类型不显示） */}
          {type !== 'all' && (
            <View>
              <Label className="text-sm text-foreground mb-2">
                <Text>选择{TYPE_LABEL[type]}</Text>
                {targetOptions.length > 0 && selectedTargetIds.length > 0 && (
                  <Text className="text-xs text-primary ml-2">已选 {selectedTargetIds.length} 个</Text>
                )}
              </Label>
              <View className="flex flex-wrap gap-2 mt-2">
                {type === 'personal' ? (
                  <View
                    className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between w-full"
                    onClick={() => setChildPickerOpen(true)}
                  >
                    <Text className="text-sm text-gray-600">
                      {selectedTargetIds.length > 0
                        ? `已选 ${selectedTargetIds.length} 个幼儿`
                        : '点击选择幼儿'}
                    </Text>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>
                ) : targetOptions.length > 0 ? targetOptions.map((opt) => {
                  const active = selectedTargetIds.includes(opt.id)
                  return (
                    <Badge
                      key={opt.id}
                      className={`cursor-pointer px-4 py-2 ${
                        active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => handleToggle(opt.id)}
                    >
                      <Text className="text-sm">{opt.label}</Text>
                    </Badge>
                  )
                }) : (
                  <Text className="block text-sm text-muted-foreground">
                    {type === 'course' && '暂无课程'}
                    {type === 'class' && '暂无班级，请先在班级管理中添加班级'}
                    {type === 'teacher' && '暂无教师'}
                  </Text>
                )}
              </View>
              {targetOptions.length > 0 && selectedTargetIds.length === 0 && (
                <Text className="block text-xs text-gray-400 mt-2">请选择通知对象</Text>
              )}
            </View>
          )}

          {/* 标题 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知标题 *</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入通知标题"
                value={title}
                maxlength={128}
                onInput={(e) => setTitle(e.detail.value)}
              />
            </View>
          </View>

          {/* 内容 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知内容 *</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl mt-2 p-4">
              <Textarea
                className="w-full bg-transparent border-transparent min-h-80"
                placeholder="请输入通知内容..."
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={2000}
              />
            </View>
            <Text className="block text-xs text-muted-foreground mt-1 text-right">
              {content.length}/2000
            </Text>
          </View>

          {/* 通知图片 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知图片</Text>
            </Label>
            <View className="flex flex-wrap gap-2 mt-2">
              {images.map((url, idx) => (
                <View key={idx} className="relative">
                  <Image src={url} className="w-16 h-16 rounded-lg" mode="aspectFill" />
                  <View
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center"
                    onClick={() => handleRemoveImage(idx)}
                  >
                    <Text className="text-white text-xs">×</Text>
                  </View>
                </View>
              ))}
              {images.length < 9 && (
                <View
                  className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center"
                  onClick={handleChooseImage}
                >
                  <Text className={uploadingImage ? 'text-xs text-gray-400' : 'text-2xl text-gray-400'}>
                    {uploadingImage ? '上传中' : '+'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 底部双按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'row', gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #f0f0f0',
          zIndex: 100
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            className="w-full rounded-xl py-3 gap-2"
            disabled={submitting}
            onClick={() => handleSubmit('draft')}
          >
            <Save size={18} color="#4B5563" />
            <Text>保存草稿</Text>
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            className="w-full bg-primary text-white rounded-xl py-3 gap-2"
            disabled={submitting}
            onClick={() => handleSubmit('published')}
          >
            <Send size={18} color="#ffffff" />
            <Text>{submitting ? '发布中...' : '发布通知'}</Text>
          </Button>
        </View>
      </View>

      {/* 草稿箱半屏弹窗 */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">草稿箱</Text>
            </DialogTitle>
          </DialogHeader>
          <View className="mt-4 space-y-3">
            {draftLoading ? (
              <Text className="block text-center text-sm text-muted-foreground py-8">加载中...</Text>
            ) : draftList.length === 0 ? (
              <Text className="block text-center text-sm text-muted-foreground py-8">暂无草稿</Text>
            ) : (
              draftList.map((draft) => (
                <View key={draft.id} className="border-b border-gray-100 py-3">
                  <Text className="block text-sm font-medium text-foreground">{draft.title}</Text>
                  <View className="flex items-center justify-between mt-2">
                    <Text className="text-xs text-muted-foreground">{formatTime(draft.created_at)}</Text>
                    <View className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditDraft(draft)}>
                        <Text className="text-xs">编辑</Text>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDraft(draft.id)}>
                        <Text className="text-xs text-red-500">删除</Text>
                      </Button>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* 幼儿选择弹窗 */}
      <Dialog open={childPickerOpen} onOpenChange={setChildPickerOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">选择幼儿</Text>
            </DialogTitle>
          </DialogHeader>
          <View className="mt-4 space-y-3">
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="搜索幼儿姓名"
                value={childSearch}
                onInput={(e) => setChildSearch(e.detail.value)}
              />
            </View>
            <View className="flex flex-wrap gap-2">
              {childrenList.filter((c) => (c.name || '').includes(childSearch.trim())).length > 0 ? (
                childrenList
                  .filter((c) => (c.name || '').includes(childSearch.trim()))
                  .map((c) => {
                    const active = selectedTargetIds.includes(c.id)
                    return (
                      <Badge
                        key={c.id}
                        className={`cursor-pointer px-4 py-2 ${
                          active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => handleToggle(c.id)}
                      >
                        <Text className="text-sm">{c.name}</Text>
                      </Badge>
                    )
                  })
              ) : (
                <Text className="block text-sm text-muted-foreground py-4">未找到匹配幼儿</Text>
              )}
            </View>
            <Button
              className="w-full bg-primary text-white rounded-xl"
              onClick={() => setChildPickerOpen(false)}
            >
              <Text>确定（已选 {selectedTargetIds.length} 个）</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}