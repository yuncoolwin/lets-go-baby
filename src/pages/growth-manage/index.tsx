import { useState, useEffect } from 'react'
import { View, Text, Image, Picker, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app'
import { childrenApi, growthApi, courseApi, teacherApi } from '@/utils/api'
import { Network } from '@/network'
import { Pencil, Trash2, Copy } from 'lucide-react-taro'
import { useDialogBack } from '@/utils/use-dialog-back'

interface GrowthRecord {
  id: string
  child_id: string
  child_name: string
  title: string
  content: string | null
  photo_urls: string[] | null
  created_at: string
  record_date: string | null
  teacher_name: string
  teacher_id?: string | null
  course_name?: string
  parent_read_at?: string | null
}

const DRAFT_KEY = 'growth_drafts'

const extractList = (res: any): any[] => {
  const data = res?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const formatToday = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const loadDraftCount = (): number => {
  try {
    const drafts = Taro.getStorageSync(DRAFT_KEY)
    return Array.isArray(drafts) ? drafts.length : 0
  } catch {
    return 0
  }
}

export default function GrowthManagePage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const isSuperadmin = currentRole?.role_type === 'superadmin'
  // 上海时区（UTC+8）口径的当天字符串，前后端一致
  const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [allChildren, setAllChildren] = useState<any[]>([])
  const [teacherClassId, setTeacherClassId] = useState('')
  const [courses, setCourses] = useState<any[]>([])
  const [filterCourseId, setFilterCourseId] = useState('')
  const [filterChildId, setFilterChildId] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [courseChildren, setCourseChildren] = useState<any[]>([])
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [draftCount, setDraftCount] = useState(0)
  const [dateOverlayVisible, setDateOverlayVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState<GrowthRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  useDialogBack(detailOpen, () => setDetailOpen(false))

  const children = teacherClassId
    ? allChildren.filter((c) => String(c.class_id) === String(teacherClassId))
    : allChildren

  useEffect(() => {
    loadChildren()
    loadCourses()
    setDraftCount(loadDraftCount())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentRole?.id) {
      loadTeacherMeta()
      doLoadRecords('', '', [], '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole?.id])

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      setAllChildren(extractList(res))
    } catch (err) {
      console.error('[GrowthManage] load children error:', err)
    }
  }

  const loadCourses = async () => {
    try {
      const res = await courseApi.list()
      setCourses(extractList(res))
    } catch (err) {
      console.error('[GrowthManage] load courses error:', err)
    }
  }

  const loadTeacherMeta = async () => {
    if (currentRole?.role_type === 'teacher' && currentRole?.id) {
      try {
        const meRes = await teacherApi.me(currentRole.id)
        const classId = meRes?.data?.class_id
        if (classId) setTeacherClassId(classId)
      } catch (err) {
        console.error('[GrowthManage] load teacher meta error:', err)
      }
    }
  }

  const fetchCourseChildren = async (courseId: string): Promise<any[]> => {
    try {
      const res = await Network.request({
        url: `/api/enrollments/by-course?course_id=${courseId}`,
        method: 'GET',
      })
      const data = res?.data
      let list: any[] = Array.isArray(data) ? data : (data?.data || data?.list || [])
      list = list.map((item: any) => ({ id: item.child_id, name: item.child_name }))
      if (teacherClassId) {
        const classChildIds = new Set(
          allChildren
            .filter((c) => String(c.class_id) === String(teacherClassId))
            .map((c) => String(c.id)),
        )
        list = list.filter((c) => classChildIds.has(String(c.id)))
      }
      return list
    } catch (err) {
      console.error('[GrowthManage] load course children error:', err)
      return []
    }
  }

  const doLoadRecords = async (
    courseId: string,
    childId: string,
    courseChildList: any[],
    date: string,
  ) => {
    if (!currentRole?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: any = { page_size: 100, role_id: currentRole.id }
      if (childId) {
        params.child_id = childId
      } else if (courseId) {
        const childIds = courseChildList.map((c) => c.id).join(',')
        if (!childIds) {
          setRecords([])
          setLoading(false)
          return
        }
        params.child_ids = childIds
      }
      if (date) params.record_date = date
      const res = await growthApi.list(params)
      const data = res?.data
      const list: GrowthRecord[] = data?.list || (Array.isArray(data) ? data : [])
      setRecords(list)
    } catch (err) {
      console.error('[GrowthManage] load records error:', err)
    }
    setLoading(false)
  }

  const handleCourseChange = async (courseId: string) => {
    setFilterCourseId(courseId)
    setFilterChildId('')
    if (courseId) {
      const list = await fetchCourseChildren(courseId)
      setCourseChildren(list)
      doLoadRecords(courseId, '', list, filterDate)
    } else {
      setCourseChildren([])
      doLoadRecords('', '', [], filterDate)
    }
  }

  const handleChildChange = (childId: string) => {
    setFilterChildId(childId)
    doLoadRecords(filterCourseId, childId, courseChildren, filterDate)
  }

  const handleDateChange = (date: string) => {
    setFilterDate(date)
    doLoadRecords(filterCourseId, filterChildId, courseChildren, date)
  }

  const goEdit = (id?: string) => {
    Taro.navigateTo({
      url: id ? `/pages/growth-edit/index?id=${id}` : '/pages/growth-edit/index',
    })
  }

  const goDrafts = () => {
    Taro.navigateTo({ url: '/pages/growth-drafts/index' })
  }

  const refreshAfterAction = () => {
    doLoadRecords(filterCourseId, filterChildId, courseChildren, filterDate)
  }

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '删除确认',
      content: '确定删除这条记录吗？相关图片也会一并删除。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await growthApi.remove(id, currentRole?.id)
            Taro.showToast({ title: '已删除', icon: 'success' })
            refreshAfterAction()
          } catch (err) {
            console.error('[GrowthManage] delete error:', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleCopy = (record: GrowthRecord) => {
    try {
      const drafts = Taro.getStorageSync(DRAFT_KEY)
      const list: any[] = Array.isArray(drafts) ? drafts : []
      const newDraft = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        child_id: record.child_id,
        child_name: record.child_name,
        course_name: record.course_name,
        title: record.title,
        content: record.content,
        photo_urls: record.photo_urls || [],
        record_date: record.record_date,
        updated_at: new Date().toISOString(),
      }
      list.unshift(newDraft)
      Taro.setStorageSync(DRAFT_KEY, list)
      setDraftCount(list.length)
      Taro.showToast({ title: '已复制到草稿箱', icon: 'success' })
    } catch (err) {
      console.error('[GrowthManage] copy error:', err)
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  const courseRange = ['全部课程', ...courses.map((c) => c.name)]
  const courseIdx = courses.findIndex((c) => c.id === filterCourseId)
  const courseIndex = courseIdx >= 0 ? courseIdx + 1 : 0

  const childList = filterCourseId ? courseChildren : children
  const childRange = ['全部幼儿', ...childList.map((c) => c.name)]
  const childIdx = childList.findIndex((c) => c.id === filterChildId)
  const childIndex = childIdx >= 0 ? childIdx + 1 : 0

  return (
    <View className="min-h-screen bg-background pb-28">
      <View className="px-4 pt-3 space-y-2">
        {/* 筛选框行 */}
        <View className="flex gap-2">
          <View
            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2"
            onClick={() => setDateOverlayVisible(true)}
          >
            <Text className="block text-sm text-foreground">{filterDate || '全部日期'}</Text>
          </View>
          <View className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
            <Picker
              mode="selector"
              range={courseRange}
              value={courseIndex}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                handleCourseChange(idx === 0 ? '' : (courses[idx - 1]?.id || ''))
              }}
            >
              <Text className="block text-sm text-foreground">
                {courseRange[courseIndex] || '全部课程'}
              </Text>
            </Picker>
          </View>
          <View className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
            <Picker
              mode="selector"
              range={childRange}
              value={childIndex}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                handleChildChange(idx === 0 ? '' : (childList[idx - 1]?.id || ''))
              }}
            >
              <Text className="block text-sm text-foreground">
                {childRange[childIndex] || '全部幼儿'}
              </Text>
            </Picker>
          </View>
        </View>
      </View>

      <View className="p-4">
        {loading ? (
          <Text className="block text-sm text-muted-foreground text-center py-12">加载中...</Text>
        ) : records.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Text className="block text-base text-muted-foreground">暂无成长档案</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {records.map((record) => (
              <Card
                key={record.id}
                onClick={() => {
                  setDetailRecord(record)
                  setDetailOpen(true)
                }}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-primary">
                      {record.child_name || '幼儿'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {record.record_date || formatDate(record.created_at)}
                    </Text>
                  </View>
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-base font-semibold text-foreground flex-1 min-w-0">
                      {record.title}
                    </Text>
                    {record.teacher_name && (
                      <Text className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                        {record.teacher_name}
                      </Text>
                    )}
                  </View>
                  {record.content && (
                    <Text
                      className="block text-sm text-gray-600 mb-2"
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
                  {record.photo_urls && record.photo_urls.length > 0 && (
                    <View className="flex gap-2 mt-2 overflow-x-auto">
                      {record.photo_urls.map((url, idx) => (
                        <Image
                          key={idx}
                          src={url}
                          className="w-20 h-20 rounded-lg flex-shrink-0"
                          mode="aspectFill"
                          onClick={(e) => {
                            e.stopPropagation()
                            Taro.previewImage({
                              urls: record.photo_urls as string[],
                              current: url,
                            })
                          }}
                        />
                      ))}
                    </View>
                  )}
                  <View className="flex items-center justify-between mt-3">
                    <Text className="text-xs text-muted-foreground">
                      {record.parent_read_at ? '已读' : '未读'}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
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
        <View style={{ flex: 1 }}>
          <Button variant="ghost" className="w-full" onClick={goDrafts}>
            <Text className="text-primary">
              草稿箱{draftCount > 0 ? `(${draftCount})` : ''}
            </Text>
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button className="w-full" onClick={() => goEdit()}>
            <Text className="text-white">新增记录</Text>
          </Button>
        </View>
      </View>

      <CalendarOverlay
        visible={dateOverlayVisible}
        value={filterDate || formatToday()}
        onChange={handleDateChange}
        onClose={() => setDateOverlayVisible(false)}
        showAllDates
      />

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
              <View className="pr-3 space-y-3">
                {detailRecord.child_name && (
                  <Text className="block text-sm text-muted-foreground">{detailRecord.child_name}</Text>
                )}
                <Text className="block text-base text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailRecord.content}
                </Text>
                {detailRecord.photo_urls && detailRecord.photo_urls.length > 0 && (
                  <View className="space-y-2">
                    {detailRecord.photo_urls.map((url, idx) => (
                      <Image key={idx} src={url} className="w-full rounded-lg" mode="widthFix" />
                    ))}
                  </View>
                )}
                <View className="flex justify-end pt-3">
                  <View className="text-right space-y-1">
                    {detailRecord.teacher_name && (
                      <Text className="block text-xs text-muted-foreground">
                        {detailRecord.teacher_name}
                      </Text>
                    )}
                    <Text className="block text-xs text-muted-foreground">
                      {detailRecord.record_date || formatDate(detailRecord.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
          <View className="flex justify-end gap-2 mt-4 border-t border-gray-100 pt-4">
            <Button variant="ghost" size="sm" onClick={() => detailRecord && handleCopy(detailRecord)}>
              <Copy size={14} color="#E8651A" />
              <Text className="text-primary text-sm">复制</Text>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { if (detailRecord) { setDetailOpen(false); goEdit(detailRecord.id) } }}>
              <Pencil size={14} color="#E8651A" />
              <Text className="text-primary text-sm">编辑</Text>
            </Button>
            {(isSuperadmin || ((detailRecord?.record_date || (detailRecord?.created_at || '').slice(0, 10)) === todayStr && detailRecord?.teacher_id === currentRole?.id)) && (
              <Button variant="ghost" size="sm" onClick={() => { if (detailRecord) { handleDelete(detailRecord.id); setDetailOpen(false) } }}>
                <Trash2 size={14} color="#ef4444" />
                <Text className="text-red-500 text-sm">删除</Text>
              </Button>
            )}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}