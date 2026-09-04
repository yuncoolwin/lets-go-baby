import { useState, useEffect, useMemo } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { useAppStore } from '@/store/app'
import { childrenApi, teacherApi, growthApi, courseApi } from '@/utils/api'
import { Network } from '@/network'
import { isH5 } from '@/lib/platform'
import { X, ImagePlus } from 'lucide-react-taro'

const DRAFT_KEY = 'growth_drafts'

const extractList = (res: any): any[] => {
  const data = res?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

const formatToday = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const genDraftId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const loadDrafts = (): any[] => {
  try {
    const d = Taro.getStorageSync(DRAFT_KEY)
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

const DIET_OPTIONS = ['一般', '正常', '很好']
const NAP_OPTIONS = ['半小时以下', '1小时-2小时', '2小时']
const STOOL_OPTIONS = ['有', '无']

const saveDrafts = (drafts: any[]) => {
  Taro.setStorageSync(DRAFT_KEY, drafts)
}

const readFileAsBase64 = (filePath: string, fileObj?: File): Promise<string> => {
  if (isH5()) {
    const readBlob = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || '')
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
      success: (r) => resolve(r.data as string),
      fail: reject,
    })
  })
}

const removeDraftById = (id: string) => {
  saveDrafts(loadDrafts().filter((d) => d.id !== id))
}

export default function GrowthEditPage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const isAgentAdmin = useAppStore((s) => s.agentOriginalRoleType === 'admin')

  const [allChildren, setAllChildren] = useState<any[]>([])
  const [teacherClassId, setTeacherClassId] = useState('')
  const [courses, setCourses] = useState<any[]>([])

  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedChildName, setSelectedChildName] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [recordDate, setRecordDate] = useState(formatToday())

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [recordId, setRecordId] = useState('')
  const [draftId, setDraftId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStep, setPickerStep] = useState<'course' | 'child'>('course')
  const [pickerCourseId, setPickerCourseId] = useState('')
  const [pickerChildren, setPickerChildren] = useState<any[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // 今日饮食反馈等 7 个可选项
  const [dietOverall, setDietOverall] = useState('')
  const [dietVegetable, setDietVegetable] = useState('')
  const [dietMeat, setDietMeat] = useState('')
  const [dietSoup, setDietSoup] = useState('')
  const [dietWater, setDietWater] = useState('')
  const [napStatus, setNapStatus] = useState('')
  const [stoolStatus, setStoolStatus] = useState('')
  const [dateOverlayVisible, setDateOverlayVisible] = useState(false)

  // 教师端本班幼儿 id 集合（用于在该课程在读幼儿基础上过滤本班）
  const classChildIds = useMemo(() => {
    if (!teacherClassId) return null
    return new Set(
      allChildren
        .filter((c) => String(c.class_id) === String(teacherClassId))
        .map((c) => String(c.id)),
    )
  }, [allChildren, teacherClassId])

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    if (params.id) {
      setRecordId(params.id)
      loadRecord(params.id)
    }
    if (params.draft_id) {
      setDraftId(params.draft_id)
      loadDraft(params.draft_id)
    }
    if (params.child_id) setSelectedChildId(params.child_id)
    loadChildren()
    loadCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      setAllChildren(extractList(res))
      if (currentRole?.role_type === 'teacher' && currentRole?.id) {
        const meRes = await teacherApi.me(currentRole.id)
        const classId = meRes?.data?.class_id
        if (classId) setTeacherClassId(classId)
      }
    } catch (err) {
      console.error('[GrowthEdit] load children error:', err)
    }
  }

  const loadCourses = async () => {
    try {
      const res = await courseApi.list()
      setCourses(extractList(res))
    } catch (err) {
      console.error('[GrowthEdit] load courses error:', err)
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
        setSelectedChildName(data.child_name || '')
        setRecordDate(data.record_date || formatToday())
        setDietOverall(data.diet_overall || '')
        setDietVegetable(data.diet_vegetable || '')
        setDietMeat(data.diet_meat || '')
        setDietSoup(data.diet_soup || '')
        setDietWater(data.diet_water || '')
        setNapStatus(data.nap_status || '')
        setStoolStatus(data.stool_status || '')
        if (data.course_name) {
          const courseList = extractList(await courseApi.list())
          const matched = courseList.find((c) => c.name === data.course_name)
          if (matched) setSelectedCourseId(matched.id)
        }
      }
    } catch (err) {
      console.error('[GrowthEdit] load record error:', err)
    }
  }

  const loadDraft = (id: string) => {
    const draft = loadDrafts().find((d) => d.id === id)
    if (draft) {
      setSelectedChildId(draft.child_id || '')
      setSelectedChildName(draft.child_name || '')
      setSelectedCourseId(draft.course_id || '')
      setTitle(draft.title || '')
      setContent(draft.content || '')
      setImages(draft.photo_urls || [])
      if (draft.record_date) setRecordDate(draft.record_date)
    }
  }

  const fetchCourseChildren = async (courseId: string): Promise<any[]> => {
    try {
      const res = await Network.request({
        url: `/api/enrollments/by-course?course_id=${courseId}&date=${recordDate}`,
        method: 'GET',
      })
      const data = res?.data
      let list: any[] = Array.isArray(data) ? data : (data?.data || data?.list || [])
      list = list.map((item: any) => ({ id: item.child_id, name: item.child_name, class_id: item.class_id, is_drop_in: item.is_drop_in }))
      if (classChildIds) {
        // 报读幼儿按本班集合保留；临时来园幼儿按 class_id 等于本班保留
        list = list.filter((c) => classChildIds.has(String(c.id)) || (c.is_drop_in && String(c.class_id) === String(teacherClassId)))
      }
      return list
    } catch (err) {
      console.error('[GrowthEdit] load course children error:', err)
      return []
    }
  }

  const openPicker = () => {
    setPickerStep('course')
    setPickerCourseId('')
    setPickerChildren([])
    setPickerOpen(true)
  }

  const handlePickerCourseSelect = async (courseId: string) => {
    setPickerCourseId(courseId)
    setPickerLoading(true)
    const list = await fetchCourseChildren(courseId)
    setPickerChildren(list)
    setPickerLoading(false)
    setPickerStep('child')
  }

  const handlePickerChildSelect = (child: any) => {
    setSelectedChildId(String(child.id))
    setSelectedChildName(child.name || '')
    setSelectedCourseId(pickerCourseId)
    setPickerOpen(false)
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 9 - images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const paths = res.tempFilePaths || []
        const tempFiles = res.tempFiles || []
        setUploading(true)
        for (let i = 0; i < paths.length; i++) {
          const path = paths[i]
          const fileObj = tempFiles[i]?.originalFileObj
          try {
            const base64 = await readFileAsBase64(path, fileObj)
            const upload = await growthApi.uploadImage({ image: base64, name: 'growth.jpg' })
            const url = upload?.data?.url
            if (url) {
              setImages((prev) => [...prev, url])
            }
          } catch (err) {
            console.error('[GrowthEdit] upload image error:', err)
            Taro.showToast({ title: '图片上传失败', icon: 'none' })
          }
        }
        setUploading(false)
      },
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveDraft = () => {
    const drafts = loadDrafts()
    const selectedCourse = courses.find((c) => c.id === selectedCourseId)
    const draft = {
      id: draftId || genDraftId(),
      child_id: selectedChildId,
      child_name: selectedChildName,
      course_id: selectedCourseId,
      course_name: selectedCourse?.name || '',
      title,
      content,
      photo_urls: images,
      record_date: recordDate,
      updated_at: new Date().toISOString(),
    }
    const idx = drafts.findIndex((d) => d.id === draft.id)
    if (idx >= 0) {
      drafts[idx] = draft
    } else {
      drafts.unshift(draft)
    }
    saveDrafts(drafts)
    Taro.showToast({ title: '已存草稿', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 600)
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
      const selectedCourse = courses.find((c) => c.id === selectedCourseId)
      const courseName = selectedCourse?.name || ''
      if (recordId) {
        await growthApi.update(
          recordId,
          {
            title, content, photo_urls: images, record_date: recordDate, course_name: courseName,
            ...(dietOverall ? { diet_overall: dietOverall } : {}),
            ...(dietVegetable ? { diet_vegetable: dietVegetable } : {}),
            ...(dietMeat ? { diet_meat: dietMeat } : {}),
            ...(dietSoup ? { diet_soup: dietSoup } : {}),
            ...(dietWater ? { diet_water: dietWater } : {}),
            ...(napStatus ? { nap_status: napStatus } : {}),
            ...(stoolStatus ? { stool_status: stoolStatus } : {}),
          },
          currentRole?.id,
        )
      } else {
        await growthApi.create(
          {
            child_id: selectedChildId, title, content, photo_urls: images, record_date: recordDate, course_name: courseName,
            ...(dietOverall ? { diet_overall: dietOverall } : {}),
            ...(dietVegetable ? { diet_vegetable: dietVegetable } : {}),
            ...(dietMeat ? { diet_meat: dietMeat } : {}),
            ...(dietSoup ? { diet_soup: dietSoup } : {}),
            ...(dietWater ? { diet_water: dietWater } : {}),
            ...(napStatus ? { nap_status: napStatus } : {}),
            ...(stoolStatus ? { stool_status: stoolStatus } : {}),
          },
          currentRole?.id,
        )
        if (draftId) removeDraftById(draftId)
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (err) {
      console.error('[GrowthEdit] save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
    setSaving(false)
  }

  return (
    <View className="min-h-screen bg-background pb-28">
      <View className="px-4 pt-3 space-y-4">
        {/* 日期 + 选择幼儿（并排） */}
        <View className="flex flex-row gap-3">
          <View className="flex-1 min-w-0">
            <Text className="block text-sm text-muted-foreground mb-2">日期</Text>
            <View
              className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3"
              onClick={() => setDateOverlayVisible(true)}
            >
              <Text className="block text-base text-foreground">{recordDate}</Text>
            </View>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-sm text-muted-foreground mb-2">选择幼儿</Text>
            <View className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3" onClick={openPicker}>
              <Text className="block text-base text-foreground truncate">
                {selectedChildName || '点击选择幼儿'}
              </Text>
            </View>
          </View>
        </View>

        {/* 标题 */}
        <View>
          <Text className="block text-sm text-muted-foreground mb-2">标题</Text>
          <View className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
            <Input
              className="w-full bg-transparent"
              placeholder="请输入标题"
              value={title}
              onInput={(e) => setTitle(e.detail.value)}
            />
          </View>
        </View>

        {/* 正文 */}
        <View>
          <Text className="block text-sm text-muted-foreground mb-2">正文</Text>
          <View className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <Textarea
              className="w-full bg-transparent border-transparent min-h-80"
              placeholder="记录孩子的成长点滴..."
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              maxlength={1000}
            />
          </View>
        </View>

        {/* 今日饮食反馈 */}
        <View className="space-y-3">
          <Text className="block text-sm font-medium text-foreground">今日饮食反馈（选填）</Text>
          <View className="flex flex-row flex-wrap">
            {([
              ['总体', dietOverall, setDietOverall, DIET_OPTIONS],
              ['蔬菜', dietVegetable, setDietVegetable, DIET_OPTIONS],
              ['荤菜', dietMeat, setDietMeat, DIET_OPTIONS],
              ['汤', dietSoup, setDietSoup, DIET_OPTIONS],
              ['喝水', dietWater, setDietWater, DIET_OPTIONS],
              ['午睡情况', napStatus, setNapStatus, NAP_OPTIONS],
              ['大便情况', stoolStatus, setStoolStatus, STOOL_OPTIONS],
            ] as [string, string, (v: string) => void, string[]][]).map(([label, value, setter, options]) => (
              <View key={label} className="w-[31%] m-[1%]">
                <Text className="block text-sm text-muted-foreground mb-2">{label}</Text>
                <View className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                  <Picker
                    mode="selector"
                    range={options}
                    onChange={(e) => setter(options[Number(e.detail.value)])}
                  >
                    <Text className="block text-base text-foreground truncate">{value || '请选择'}</Text>
                  </Picker>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 图片 */}
        <View>
          <Text className="block text-sm text-muted-foreground mb-2">照片（{images.length}/9）</Text>
          <View className="flex flex-wrap gap-2">
            {images.map((url, idx) => (
              <View key={idx} className="relative">
                <Image src={url} className="w-20 h-20 rounded-lg" mode="aspectFill" />
                <View
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black bg-opacity-60 flex items-center justify-center"
                  onClick={() => removeImage(idx)}
                >
                  <X size={12} color="#fff" />
                </View>
              </View>
            ))}
            {images.length < 9 && (
              <View
                className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center"
                onClick={handleChooseImage}
              >
                <ImagePlus size={24} color="#999999" />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 底部操作栏 */}
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
          gap: '12px',
        }}
      >
        {!recordId && (
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { if (!isAgentAdmin) handleSaveDraft() }}
              disabled={isAgentAdmin || saving || uploading}
            >
              <Text className="text-primary">存草稿</Text>
            </Button>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button className="w-full" onClick={() => { if (!isAgentAdmin) handleSave() }} disabled={isAgentAdmin || saving || uploading}>
            <Text className="text-white">{saving ? '保存中...' : '保存'}</Text>
          </Button>
        </View>
      </View>

      {/* 两步选择幼儿 */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open)
          if (!open) setPickerStep('course')
        }}
      >
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">
                {pickerStep === 'course' ? '选择课程' : '选择幼儿'}
              </Text>
            </DialogTitle>
          </DialogHeader>

          {pickerStep === 'course' ? (
            <View className="flex flex-wrap gap-2 my-3">
              {courses.map((c) => (
                <Badge
                  key={c.id}
                  className="bg-gray-100 text-gray-600"
                  onClick={() => handlePickerCourseSelect(c.id)}
                >
                  <Text className="text-sm">{c.name}</Text>
                </Badge>
              ))}
              {courses.length === 0 && (
                <Text className="block text-sm text-muted-foreground py-4">暂无课程</Text>
              )}
            </View>
          ) : (
            <View className="my-3">
              <View className="mb-3">
                <Text
                  className="text-sm text-primary"
                  onClick={() => {
                    setPickerStep('course')
                    setPickerChildren([])
                  }}
                >
                  返回课程
                </Text>
              </View>
              {pickerLoading ? (
                <Text className="block text-sm text-muted-foreground py-4">加载中...</Text>
              ) : (
                <View className="flex flex-wrap gap-2">
                  {pickerChildren.map((c) => (
                    <Badge
                      key={c.id}
                      className={
                        selectedChildId === String(c.id)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600'
                      }
                      onClick={() => handlePickerChildSelect(c)}
                    >
                      <Text className="text-sm">{c.name}</Text>
                    </Badge>
                  ))}
                  {pickerChildren.length === 0 && (
                    <Text className="block text-sm text-muted-foreground py-4">
                      该课程暂无在读幼儿
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          <Button className="w-full mt-2" onClick={() => setPickerOpen(false)}>
            <Text className="text-white">确定</Text>
          </Button>
        </DialogContent>
      </Dialog>

      <CalendarOverlay
        visible={dateOverlayVisible}
        value={recordDate}
        onChange={(d) => setRecordDate(d)}
        onClose={() => setDateOverlayVisible(false)}
      />
    </View>
  )
}