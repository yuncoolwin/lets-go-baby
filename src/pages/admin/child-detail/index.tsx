import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { childrenApi, enrollmentApi, classApi, courseApi, adminApi, dailyApi } from '@/utils/api'
import { format } from 'date-fns'

import { Pencil, Trash2, BookOpen, Plus, X, Info } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'

import { CalendarOverlay } from '@/components/ui/calendar-overlay'

interface ChildDetail {
  id: string
  name: string
  nickname?: string
  gender: string
  birth_date: string
  class_id: string | null
  parent_name: string | null
  parent_phone: string | null
  health_info: string | null
  allergies: string | null
  status: string
  course_type: string | null
  enrollment_duration: string | null
  custom_days: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  class_info?: {
    id: string
    name: string
    level: string
    room: string
  } | null
}

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在读', className: 'bg-green-100 text-green-700' },
  graduated: { label: '毕业', className: 'bg-blue-100 text-blue-700' },
  suspended: { label: '休学', className: 'bg-orange-100 text-orange-700' },
}

const calculateAge = formatAge

/** 获取下一个周六的日期，若今天就是周六则返回今天 */
const getNextSaturday = (): string => {
  const now = new Date()
  const day = now.getDay() // 0=周日, 1=周一, ..., 6=周六
  if (day === 6) {
    return now.toISOString().split('T')[0]
  }
  // 距离下一个周六的天数
  const daysUntilSaturday = day === 0 ? 6 : 6 - day
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntilSaturday)
  return next.toISOString().split('T')[0]
}

export default function ChildDetailPage() {
  const router = useRouter()
  const { id, readonly } = router.params
  const isReadonly = readonly === 'true'
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [editingEnrollment, setEditingEnrollment] = useState<any | null>(null)
  const [formCourseType, setFormCourseType] = useState('')
  const [formDurationType, setFormDurationType] = useState('计日')
  const [formDurationDays, setFormDurationDays] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formStatus, setFormStatus] = useState('进行中')
  const [formPaymentAmount, setFormPaymentAmount] = useState('')
  const [formPaymentChannel, setFormPaymentChannel] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false)
  const [showCalendar, setShowCalendar] = useState<'birthDate' | 'startDate' | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [extendDetails, setExtendDetails] = useState<any[]>([])
  const [extendTotalDays, setExtendTotalDays] = useState(0)
  const [extendToDate, setExtendToDate] = useState('')
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [extendAnim, setExtendAnim] = useState<'open' | 'close' | 'idle'>('idle')
  const extendTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [parents, setParents] = useState<Array<{ id: string; parent_name: string; relationship: string }>>([])

  useEffect(() => {
    if (showExtendDialog) {
      setExtendAnim('idle')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExtendAnim('open')
        })
      })
    }
  }, [showExtendDialog])

  const handleCloseExtendDialog = () => {
    setExtendAnim('close')
    clearTimeout(extendTimerRef.current)
    extendTimerRef.current = setTimeout(() => {
      setShowExtendDialog(false)
      setExtendAnim('idle')
      setExtendDetails([])
      setExtendTotalDays(0)
      setExtendToDate('')
    }, 200)
  }

  // 幼儿基本信息编辑
  const [isEditingChild, setIsEditingChild] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [editGender, setEditGender] = useState('male')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editParentName, setEditParentName] = useState('')
  const [editParentPhone, setEditParentPhone] = useState('')

  // 考勤日历弹窗
  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false)
  const [currentAttendanceCalendar, setCurrentAttendanceCalendar] = useState<{
    enrollmentId: string
    courseType: string
    startDate: string
    endDate: string
    attendanceData: any[]
    loading: boolean
    selectedDate?: string
  } | null>(null)
  const [calDisplayYear, setCalDisplayYear] = useState(new Date().getFullYear())
  const [calDisplayMonth, setCalDisplayMonth] = useState(new Date().getMonth() + 1)
  const [attendanceDayFeedback, setAttendanceDayFeedback] = useState<any>(null)
  const [editAllergies, setEditAllergies] = useState('')
  const [editHealthInfo, setEditHealthInfo] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const statusOptions = [
    { value: 'active', label: '在读' },
    { value: 'graduated', label: '毕业' },
    { value: 'suspended', label: '休学' },
  ]

  const genderOptions = [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' },
  ]

  const startEditing = () => {
    if (!child) return
    setEditName(child.name || '')
    setEditNickname(child.nickname || '')
    setEditGender(child.gender || 'male')
    setEditBirthDate(child.birth_date || '')
    setEditStatus(child.status || 'active')
    setEditParentName(child.parent_name || '')
    setEditParentPhone(child.parent_phone || '')
    setEditAllergies(child.allergies || '')
    setEditHealthInfo(child.health_info || '')
    setIsEditingChild(true)
  }

  const cancelEditing = () => {
    setIsEditingChild(false)
  }

  const handleSaveChild = async () => {
    if (!editName.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!editBirthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }
    setEditSubmitting(true)
    try {
      const payload: Record<string, any> = {
        name: editName.trim(),
        nickname: editNickname.trim() || undefined,
        gender: editGender,
        birth_date: editBirthDate,
        status: editStatus,
        parent_name: editParentName || undefined,
        parent_phone: editParentPhone || undefined,
        allergies: editAllergies || undefined,
        health_info: editHealthInfo || undefined,
      }
      const res = await childrenApi.update(id!, payload)
      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setIsEditingChild(false)
        loadData()
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setEditSubmitting(false)
    }
  }


  const openAddEnrollment = () => {
    setEditingEnrollment(null)
    setFormCourseType('')
    setFormDurationType('计日')
    setFormDurationDays('')
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    setFormStartDate(dateStr)
    setFormEndDate('')
    setFormStatus('进行中')
    setFormPaymentAmount('')
    setFormPaymentChannel('')
    setFormClassId('')
    setShowEnrollmentForm(true)
  }

  const openEditEnrollment = (enr: any) => {
    setEditingEnrollment(enr)
    setFormCourseType(enr.course_type || '')
    setFormDurationType(enr.duration_type || '计日')
    setFormDurationDays(enr.duration_days ? String(enr.duration_days) : '')
    setFormStartDate(enr.start_date || '')
    setFormEndDate(enr.end_date || '')
    setFormStatus(enr.status || '进行中')
    setFormPaymentAmount(enr.payment_amount || '')
    setFormPaymentChannel(enr.payment_channel || '')
    setFormClassId(enr.class_id || '')
    setShowEnrollmentForm(true)
  }

  // 计算结束日期
  const calcEndDate = async (courseType: string, durationType: string, durationDays: string, startDate: string) => {
    if (!courseType || !durationType || !startDate) {
      setFormEndDate('')
      return
    }
    const course = courses.find((c: any) => c.name === courseType)
    try {
      const res = await childrenApi.calcEndDate({
        course_type: courseType,
        enrollment_duration: durationType,
        custom_days: durationType === '计日' ? durationDays : '',
        start_date: startDate,
        date_calc_rule: course?.date_calc_rule || '工作日',
      })
      if (res.code === 200 && res.data?.end_date) {
        setFormEndDate(res.data.end_date)
      } else {
        setFormEndDate('')
      }
    } catch {
      setFormEndDate('')
    }
  }

  const handleSubmitEnrollment = async () => {
    if (!formCourseType) {
      Taro.showToast({ title: '请选择课程类型', icon: 'none' })
      return
    }
    if (!formStartDate) {
      Taro.showToast({ title: '请选择开始日期', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const payload: any = {
        child_id: id,
        course_type: formCourseType,
        course_id: (courses.find(c => c.name === formCourseType)?.id) || null,
        duration_type: formDurationType,
        duration_days: formDurationType === '计日' ? (parseInt(formDurationDays) || 0) : 0,
        start_date: formStartDate,
        end_date: formEndDate || null,
        status: formStatus,
        payment_amount: formPaymentAmount || null,
        payment_channel: formPaymentChannel || null,
        class_id: formClassId || null,
        date_calc_rule: (courses.find((c: any) => c.name === formCourseType)?.date_calc_rule) || '工作日',
      }
      let result
      if (editingEnrollment) {
        result = await enrollmentApi.update(editingEnrollment.id, payload)
      } else {
        result = await enrollmentApi.create(payload)
      }
      if (result.code === 200) {
        Taro.showToast({ title: editingEnrollment ? '修改成功' : '新增成功', icon: 'success' })
        setShowEnrollmentForm(false)
        loadData()
      } else {
        Taro.showToast({ title: result.msg || '操作失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEnrollment = (enr: any) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除"${enr.course_type}"报读记录吗？`,
      confirmColor: '#E8651A',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await enrollmentApi.remove(enr.id)
            if (result.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              loadData()
            } else {
              Taro.showToast({ title: result.msg || '删除失败', icon: 'none' })
            }
          } catch {
            Taro.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      },
    })
  }

  // 考勤日历相关
  const handleOpenAttendanceCalendar = async (enr: any) => {
    setCurrentAttendanceCalendar({
      enrollmentId: enr.id,
      courseType: enr.course_type,
      startDate: enr.start_date,
      endDate: enr.extended_end_date || enr.end_date,
      attendanceData: [],
      loading: false,
    })
    setShowAttendanceCalendar(true)
    try {
      const res: any = await enrollmentApi.getAttendanceCalendar(enr.id)
      console.log('[AttendanceCalendar] open calendar, response:', res.data)
      setCurrentAttendanceCalendar(prev => prev ? { ...prev, attendanceData: res.data || [] } : null)
    } catch (e) {
      console.error('[AttendanceCalendar] load error:', e)
      Taro.showToast({ title: '加载考勤数据失败', icon: 'none' })
    }
  }

  const handleUnbindParent = (relationId: string) => {
    Taro.showModal({
      title: '确认解除绑定',
      content: '确定要解除该家长与幼儿的绑定关系吗？',
      confirmColor: '#E8651A',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await adminApi.removeParentBinding(id!, relationId)
            if (result.code === 200) {
              Taro.showToast({ title: '已解除绑定', icon: 'success' })
              loadData()
            } else {
              Taro.showToast({ title: result.msg || '解除绑定失败', icon: 'none' })
            }
          } catch {
            Taro.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      },
    })
  }

  const loadExtendDetail = async (enr: any) => {
    try {
      const res = await enrollmentApi.calcExtendedEndDate(enr.id)
      console.log('calcExtendedEndDate res:', res)
      // res 是 Taro.request 返回的 { data, statusCode, header }
      // res.data 是 HTTP 响应体: { code, msg, data }
      const body = res.data || res
      const actualData = body.data || body
      if (actualData && actualData.details) {
        setExtendDetails(actualData.details)
        const total = actualData.details.reduce((sum: number, d: any) => sum + (d.overlapDays || 0), 0)
        setExtendTotalDays(total)
        setExtendToDate(actualData.extended_end_date || '')
        setShowExtendDialog(true)
      } else {
        console.warn('calcExtendedEndDate 数据格式异常:', body)
      }
    } catch (e) {
      console.error('加载顺延详情失败', e)
    }
  }

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [childRes, enrRes, clsRes, courseRes, parentRes] = await Promise.all([
        childrenApi.detail(id),
        enrollmentApi.list(id!),
        classApi.list({ page: 1, page_size: 100 }),
        courseApi.list(),
        adminApi.getChildParents(id!),
      ])
      if (childRes.code === 200 && childRes.data) {
        setChild(childRes.data as unknown as ChildDetail)
      } else {
        Taro.showToast({ title: childRes.msg || '加载失败', icon: 'none' })
      }
      if (enrRes.code === 200 && Array.isArray(enrRes.data)) {
        // 自动计算并更新每条报读记录的顺延结束日期
        const enrollList = enrRes.data as any[]
        const updated = await Promise.all(
          enrollList.map(async (enr) => {
            try {
              const res = await enrollmentApi.calcExtendedEndDate(enr.id)
              const body = res.data || res
              const data = body?.data || body
              if (data?.extended_end_date) {
                return { ...enr, extended_end_date: data.extended_end_date }
              }
            } catch { /* ignore */ }
            return enr
          })
        )
        setEnrollments(updated)
      }
      if (clsRes.code === 200 && clsRes.data?.list && Array.isArray(clsRes.data.list)) {
        setClasses(clsRes.data.list)
      }
      if (courseRes.code === 200) {
        const list = Array.isArray(courseRes.data) ? courseRes.data : courseRes.data?.list || []
        setCourses(list)
      }
      if (parentRes.code === 200 && Array.isArray(parentRes.data)) {
        setParents(parentRes.data)
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    loadData()
  })

  const handleDelete = () => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除幼儿"${child?.name}"的档案吗？此操作不可恢复。`,
      confirmColor: '#E8651A',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await childrenApi.remove(id!)
            if (result.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                Taro.navigateBack()
              }, 1500)
            } else {
              Taro.showToast({ title: result.msg || '删除失败', icon: 'none' })
            }
          } catch {
            Taro.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      },
    })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </View>
    )
  }

  if (!child) {
    return (
      <View className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <Text className="text-muted-foreground">幼儿档案不存在</Text>
        <Button className="mt-4" onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </Button>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      

      <View className="p-4 space-y-4">
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-start gap-4 mb-4">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full flex-shrink-0" mode="aspectFit" />
              <View className="flex-1">
                <View className="flex items-center gap-2">
                  <View className="flex items-baseline">
                    <Text className="text-xl font-bold text-foreground">{child.name}</Text>
                    {child.nickname && <Text className="text-sm text-muted-foreground">（{child.nickname}）</Text>}
                  </View>
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
                </View>
                <Text className="block text-sm text-muted-foreground mt-1">
                  {child.gender === 'male' ? '男' : '女'} · {calculateAge(child.birth_date)}
                </Text>
              </View>
              <View className="flex items-center gap-3 flex-shrink-0 pt-1">
                <Pencil size={18} color="#999" onClick={startEditing} />
                {!isReadonly && <Trash2 size={18} color="#E8651A" onClick={handleDelete} />}
              </View>
            </View>

            <View className="space-y-3">
              {isEditingChild ? (
                <>
                  {/* 姓名 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">姓名 *</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="请输入幼儿姓名" value={editName} onInput={(e) => setEditName(e.detail.value)} />
                    </View>
                  </View>
                  {/* 昵称 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">幼儿昵称</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="请输入幼儿昵称（选填）" value={editNickname} onInput={(e) => setEditNickname(e.detail.value)} />
                    </View>
                  </View>
                  {/* 性别 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">性别 *</Label>
                    <View className="mt-1 flex gap-2">
                      {genderOptions.map((opt) => (
                        <View key={opt.value} className={`px-4 py-2 rounded-lg text-sm ${editGender === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'}`} onClick={() => setEditGender(opt.value)}>
                          <Text className="block text-sm">{opt.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {/* 出生日期 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">出生日期 *</Label>
                    <View
                      className="mt-1 bg-gray-50 rounded-lg px-3 py-2"
                      onClick={() => setShowCalendar('birthDate')}
                    >
                      <Text className="block text-sm text-foreground">{editBirthDate || '请选择出生日期'}</Text>
                    </View>
                  </View>
                  {/* 在读状态 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">在读状态 *</Label>
                    {isReadonly ? (
                      <View className="mt-1 px-3 py-2 bg-gray-100 rounded-lg">
                        <Text className="block text-sm text-foreground">{statusMap[editStatus]?.label || editStatus}</Text>
                      </View>
                    ) : (
                      <View className="mt-1 flex gap-2">
                        {statusOptions.map((opt) => (
                          <View key={opt.value} className={`px-4 py-2 rounded-lg text-sm ${editStatus === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'}`} onClick={() => setEditStatus(opt.value)}>
                            <Text className="block text-sm">{opt.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {/* 过敏情况 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">过敏情况</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="无" value={editAllergies} onInput={(e) => setEditAllergies(e.detail.value)} />
                    </View>
                  </View>
                  {/* 家长姓名 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">家长姓名</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="请输入家长姓名" value={editParentName} onInput={(e) => setEditParentName(e.detail.value)} />
                    </View>
                  </View>
                  {/* 家长电话 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">家长电话</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="请输入家长电话" value={editParentPhone} onInput={(e) => setEditParentPhone(e.detail.value)} />
                    </View>
                  </View>
                  {/* 健康信息 */}
                  <View>
                    <Label className="text-sm font-medium text-foreground">健康信息</Label>
                    <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Input className="w-full bg-transparent text-sm" placeholder="请输入健康信息" value={editHealthInfo} onInput={(e) => setEditHealthInfo(e.detail.value)} />
                    </View>
                  </View>
                  {/* 操作按钮 */}
                  <View className="flex gap-3 pt-2">
                    <View className="flex-1">
                      <Button className="w-full bg-gray-100 text-foreground rounded-xl py-3" onClick={cancelEditing}>
                        <Text>取消</Text>
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button className="w-full bg-primary text-primary-foreground rounded-xl py-3" onClick={handleSaveChild} disabled={editSubmitting}>
                        <Text>{editSubmitting ? '保存中...' : '保存'}</Text>
                      </Button>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View className="flex items-center justify-between py-2 border-b border-border">
                    <Text className="text-sm text-muted-foreground">出生日期</Text>
                    <Text className="text-sm text-foreground">{child.birth_date || '未设置'}</Text>
                  </View>
                  <View className="flex items-center justify-between py-2 border-b border-border">
                    <Text className="text-sm text-muted-foreground">在读状态</Text>
                    <Text className="text-sm text-foreground">{statusMap[child.status]?.label || child.status}</Text>
                  </View>
                  <View className="flex items-center justify-between py-2 border-b border-border">
                    <Text className="text-sm text-muted-foreground">过敏情况</Text>
                    <Text className="text-sm text-foreground">{child.allergies || '无'}</Text>
                  </View>
                  <View className="flex items-center justify-between py-2 border-b border-border">
                    <Text className="text-sm text-muted-foreground">家长姓名</Text>
                    <Text className="text-sm text-foreground">{child.parent_name || '未设置'}</Text>
                  </View>
                  <View className="flex items-center justify-between py-2 border-b border-border">
                    <Text className="text-sm text-muted-foreground">家长电话</Text>
                    <Text className="text-sm text-foreground">{child.parent_phone || '未设置'}</Text>
                  </View>
                  <View className="flex items-center justify-between py-2">
                    <Text className="text-sm text-muted-foreground">健康信息</Text>
                    <Text className="text-sm text-foreground">{child.health_info || '无'}</Text>
                  </View>
                </>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 报读记录卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <View className="flex items-center gap-2">
                <BookOpen size={16} color="#666" />
                <Text className="text-base font-semibold text-foreground">报读记录</Text>
              </View>
              {!isReadonly && (
                <Button className="h-8 px-3 bg-primary text-white rounded-lg" onClick={openAddEnrollment}>
                  <View className="flex items-center gap-1">
                    <Plus size={14} color="#fff" />
                    <Text className="text-xs text-white">新增报读</Text>
                  </View>
                </Button>
              )}
            </View>
            {enrollments.length === 0 ? (
              <View className="py-8 flex items-center justify-center">
                <Text className="text-sm text-muted-foreground">暂无报读记录，点击&quot;新增报读&quot;添加</Text>
              </View>
            ) : (
              enrollments.map((enr) => (
                <View
                  key={enr.id}
                  className="bg-gray-50 rounded-xl p-3 mb-2 relative"
                >
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-sm font-semibold text-foreground">{enr.course_type}</Text>
                    <View className="flex items-center gap-2">
                      <Badge className={enr.status === '进行中' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        <Text className="text-xs">{enr.status}</Text>
                      </Badge>
                      <View
                        onClick={() => handleOpenAttendanceCalendar(enr)}
                        className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{ backgroundColor: '#EBF5FF', borderColor: '#BFDBFE', color: '#3B82F6' }}
                      >
                        <Text className="text-xs" style={{ color: '#3B82F6' }}>考勤日历</Text>
                      </View>
                    </View>
                  </View>
                  {!isReadonly && (
                    <View className="absolute bottom-3 right-3 flex items-center gap-3">
                      <View onClick={() => openEditEnrollment(enr)}>
                        <Pencil size={14} color="#999" />
                      </View>
                      <View onClick={() => handleDeleteEnrollment(enr)}>
                        <Trash2 size={14} color="#999" />
                      </View>
                    </View>
                  )}
                  <Text className="block text-xs text-gray-500">
                    时长：{enr.duration_type === '计日' ? `${enr.duration_days}天` : enr.duration_type}
                  </Text>
                  {enr.attendance_stats && (
                    <Text className="block text-xs text-gray-500 mt-1">
                      课时记录：{enr.attendance_stats.attended_days}/{enr.attendance_stats.total_days}，请假{enr.attendance_stats.leave_days}天，缺席{enr.attendance_stats.absent_days}天
                    </Text>
                  )}
                  <Text className="block text-xs text-gray-500 mt-1">
                    班级：{enr.class_id ? (() => { const cls = classes.find((c: any) => c.id === enr.class_id); return cls ? `${cls.name}${cls.room ? `（${cls.room}）` : ''}` : '' })() : ''}
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    日期：{enr.start_date || '--'} ~ {enr.end_date || '--'}
                  </Text>
                  {(enr.payment_amount || enr.payment_channel) && (
                    <Text className="block text-xs text-gray-500 mt-1">
                      缴费：{enr.payment_amount ? `${enr.payment_amount}元` : ''}{enr.payment_channel ? `（${enr.payment_channel}）` : ''}
                    </Text>
                  )}
                  <View className="flex flex-row items-center mt-1">
                    <Text className="text-xs" style={enr.extended_end_date ? { color: '#E8651A' } : {}}>
                      顺延结束日期：{enr.extended_end_date || '无'}
                    </Text>
                    {enr.extended_end_date && (
                      <View className="ml-1" onClick={() => loadExtendDetail(enr)}>
                        <Info size={12} color="#999" />
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>

        {/* 已绑定家长卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-3">
              <Text className="text-base font-semibold text-foreground">已绑定家长</Text>
            </View>
            {parents.length === 0 ? (
              <View className="py-4 flex items-center justify-center">
                <Text className="text-sm text-muted-foreground">暂无绑定家长</Text>
              </View>
            ) : (
              parents.map((parent) => (
                <View
                  key={parent.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 mb-2"
                >
                  <Text className="text-sm text-foreground">{parent.relationship}</Text>
                  {!isReadonly && (
                    <View
                      className="ml-2"
                      onClick={() => handleUnbindParent(parent.id)}
                    >
                      <Text className="text-xs text-red-500">解除绑定</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </CardContent>
        </Card>

        </View>
      {/* 报读表单弹窗 */}
      {showEnrollmentForm && (
        <View
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(255,248,240,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowEnrollmentForm(false)}
        >
          <View
            className="bg-white rounded-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex items-center justify-between p-4 border-b border-border">
              <Text className="text-lg font-semibold">{editingEnrollment ? '编辑报读' : '新增报读'}</Text>
              <X size={20} color="#666" onClick={() => setShowEnrollmentForm(false)} />
            </View>
            <View className="p-4 space-y-4">
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">课程类型</Text>
                <View className="flex flex-wrap gap-2">
                  {courses.filter(c => c.status === '启用').map((c) => (
                    <View
                      key={c.id}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        formCourseType === c.name
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => {
                        const newType = c.name
                        setFormCourseType(newType)
                        const rules = (c.date_calc_rule || '').split(',')
                        // 如果包含周六规则，默认开始日期为下周六
                        if (rules.includes('周六')) {
                          const saturdayDate = getNextSaturday()
                          setFormStartDate(saturdayDate)
                          if (newType === '兴趣班' || rules.includes('工作日')) {
                            setFormDurationType('计日')
                            setFormDurationDays('')
                            // 计日天数未输入时不计算结束日期
                          } else {
                            setFormDurationType('计日')
                            setFormDurationDays('')
                            // 计日天数未输入时不计算结束日期
                          }
                        } else if (newType === '兴趣班') {
                          setFormDurationType('计日')
                          setFormDurationDays('')
                          // 计日天数未输入时不计算结束日期
                        } else {
                          calcEndDate(newType, formDurationType, formDurationDays, formStartDate)
                        }
                      }}
                    >
                      <Text>{c.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">报读时长</Text>
                <View className="flex flex-wrap gap-2">
                  {['一周体验', '1个月', '3个月', '6个月', '12个月', '计日'].map((t) => {
                    const disabled = ['周六托', '兴趣班'].includes(formCourseType) && t !== '计日'
                    return (
                      <View
                        key={t}
                        className={`px-3 py-2 rounded-lg text-sm ${
                          disabled ? 'bg-gray-100 text-gray-300' : formDurationType === t ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => {
                          if (!disabled) {
                            const newDuration = t
                            setFormDurationType(newDuration)
                            setFormDurationDays('')
                            if (newDuration === '计日') {
                              setFormEndDate('')
                            } else {
                              calcEndDate(formCourseType, newDuration, '', formStartDate)
                            }
                          }
                        }}
                      >
                        <Text>{t}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              {formDurationType === '计日' && (
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">计日天数</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      type="number"
                      placeholder="请输入天数"
                      value={formDurationDays}
                      onInput={(e) => {
                        const val = e.detail.value
                        setFormDurationDays(val)
                        calcEndDate(formCourseType, formDurationType, val, formStartDate)
                      }}
                    />
                  </View>
                </View>
              )}
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">开始日期</Text>
                <View
                  className="bg-gray-50 rounded-xl px-4 py-3"
                  onClick={() => setShowCalendar('startDate')}
                >
                  <Text className={`text-sm ${formStartDate ? 'text-foreground' : 'text-gray-400'}`}>
                    {formStartDate || '请选择开始日期'}
                  </Text>
                </View>
                {formCourseType === '周六托' && (
                  <Text className="block text-xs text-orange-500 mt-1">周六托仅可选择周六</Text>
                )}
                {formDurationType === '一周体验' && (
                  <Text className="block text-xs text-orange-500 mt-1">一周体验不可选择周末</Text>
                )}
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">结束日期</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Text className="text-sm text-gray-600">{formEndDate || '自动计算'}</Text>
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">所在班级</Text>
                <View className="flex flex-wrap gap-2">
                  <View
                    className={`px-3 py-2 rounded-lg text-sm ${
                      !formClassId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setFormClassId('')}
                  >
                    <Text>未分班</Text>
                  </View>
                  {classes.map((c: any) => (
                    <View
                      key={c.id}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        formClassId === c.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => setFormClassId(c.id)}
                    >
                      <Text>{c.name}{c.room ? `（${c.room}）` : ''}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">状态</Text>
                <View className="flex flex-wrap gap-2">
                  {['进行中', '已结束'].map((s) => (
                    <View
                      key={s}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        formStatus === s ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => setFormStatus(s)}
                    >
                      <Text>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">缴费记录</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    type="number"
                    placeholder="请输入缴费金额"
                    value={formPaymentAmount}
                    onInput={(e) => setFormPaymentAmount(e.detail.value)}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm font-medium text-foreground mb-1">缴费渠道</Text>
                <View className="flex flex-wrap gap-2">
                  {['微信', '支付宝', '现金'].map((c) => (
                    <View
                      key={c}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        formPaymentChannel === c ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => setFormPaymentChannel(c)}
                    >
                      <Text>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Button
                className="w-full bg-primary text-primary-foreground rounded-xl py-3"
                onClick={handleSubmitEnrollment}
                disabled={submitting}
              >
                <Text>{submitting ? '保存中...' : '保存'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 日历选择器浮层 */}
      <CalendarOverlay
        visible={showCalendar === 'birthDate'}
        onClose={() => setShowCalendar(null)}
        value={editBirthDate}
        onChange={(dateStr) => setEditBirthDate(dateStr)}
      />
      <CalendarOverlay
        visible={showCalendar === 'startDate'}
        onClose={() => setShowCalendar(null)}
        value={formStartDate}
        onChange={(dateStr) => {
          setFormStartDate(dateStr)
          calcEndDate(formCourseType, formDurationType, formDurationDays, dateStr)
        }}
        disabled={(date) => {
          const selectedCourse = courses.find(c => c.name === formCourseType)
          const rules = (selectedCourse?.date_calc_rule || '').split(',')
          const hasWeekday = rules.includes('工作日')
          const hasSaturday = rules.includes('周六')
          if (hasSaturday && !hasWeekday) return date.getDay() !== 6
          if (formDurationType === '一周体验' && hasWeekday) return date.getDay() === 0 || date.getDay() === 6
          return false
        }}
      />

      {showExtendDialog && (
        <View
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
          onClick={handleCloseExtendDialog}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: '20px 20px 16px',
              width: '88%',
              maxWidth: 400,
              maxHeight: '80vh',
              overflowY: 'auto',
              transform: extendAnim === 'open' ? 'scale(1)' : 'scale(0.3)',
              opacity: extendAnim === 'idle' ? 0 : 1,
              transition: extendAnim === 'open'
                ? 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out'
                : extendAnim === 'close'
                ? 'transform 200ms ease-in, opacity 200ms ease-in'
                : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-lg font-bold text-center mb-3">顺延原因</Text>
            <View className="py-2">
              {extendDetails.length === 0 ? (
                <Text className="block text-sm text-gray-500 text-center py-4">暂无顺延假期</Text>
              ) : (
                extendDetails.map((item, idx) => {
                  const typeLabel = item.type === '全园' ? '全园' : item.type === '班级' ? '班级' : '个人'
                  const typeColor = item.type === '全园' ? 'bg-blue-100 text-blue-700' : item.type === '班级' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  return (
                    <View key={idx} className="flex flex-row items-center mb-3 pb-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <View className="flex-1">
                        <Text className="block text-sm font-medium">{item.name}</Text>
                        <View className="flex flex-row items-center mt-1">
                          <Text className={`inline-block text-xs px-2 py-1 rounded ${typeColor}`}>{typeLabel}</Text>
                          <Text className="block text-xs text-gray-500 ml-2">{item.startDate} ~ {item.endDate}</Text>
                        </View>
                      </View>
                      <Text className="block text-sm text-orange-500 font-medium ml-2">顺延{item.overlapDays}天</Text>
                    </View>
                  )
                })
              )}
            </View>
            <View className="pt-3" style={{ borderTop: '1px solid #e5e5e5' }}>
              <Text className="block text-sm text-gray-500 text-center">
                共顺延 <Text className="font-bold text-orange-500">{extendTotalDays}</Text> 天，顺延至 <Text className="font-bold text-orange-500">{extendToDate}</Text>
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ========== 考勤日历弹窗 ========== */}
      {showAttendanceCalendar && (
        <View className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => { setShowAttendanceCalendar(false); setCurrentAttendanceCalendar(null) }}>
          <View className="rounded-3xl w-[95%] max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFF8EE', zIndex: 1 }} onClick={e => e.stopPropagation()}>
            {/* 标题栏 */}
            <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-base font-semibold text-gray-800">
                {currentAttendanceCalendar?.courseType || '课程'}考勤日历
              </Text>
              <View
                onClick={() => {
                  setShowAttendanceCalendar(false)
                  setCurrentAttendanceCalendar(null)
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full"
                style={{ backgroundColor: '#FFF8EE' }}
              >
                <Text className="text-gray-500 text-lg leading-none">✕</Text>
              </View>
            </View>

            {/* 日历主体 */}
            <View className="flex-1 overflow-y-auto p-3">
              {(() => {
                const cal = currentAttendanceCalendar
                if (!cal) return null
                const { startDate, endDate, attendanceData } = cal
                const today = format(new Date(), 'yyyy-MM-dd')
                const selectedDate = cal.selectedDate

                const displayYear = calDisplayYear
                const displayMonth = calDisplayMonth
                const firstDay = new Date(displayYear, displayMonth - 1, 1)
                const lastDay = new Date(displayYear, displayMonth, 0)
                const startDow = firstDay.getDay()
                const daysInMonth = lastDay.getDate()

                const attendanceMap: Record<string, string> = {}
                const holidayMap: Record<string, string> = {}
                ;(attendanceData || []).forEach((item: any) => {
                  if (item.status === 'holiday') {
                    holidayMap[item.date] = item.name
                  } else {
                    attendanceMap[item.date] = item.status
                  }
                })

                const getDayClass = (ds: string) => {
                  if (ds < startDate || ds > endDate) return 'text-gray-300'
                  if (ds === selectedDate) return 'text-white font-semibold'
                  if (ds === today) return 'text-blue-500 font-semibold'
                  return 'text-gray-800'
                }

                const getTextWrapperClass = (ds: string) => {
                  if (ds < startDate || ds > endDate) return ''
                  if (ds === selectedDate) return 'flex items-center justify-center w-8 h-8 rounded-full bg-blue-500'
                  return 'flex items-center justify-center w-8 h-8'
                }

                const handleDayClick = async (d: number) => {
                  const ds = `${displayYear}-${String(displayMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  if (ds < startDate || ds > endDate) return
                  setCurrentAttendanceCalendar(prev => prev ? { ...prev, selectedDate: ds } : null)
                  console.log('>>> handleDayClick 被调用, childId:', child.id, ', date:', ds)
                  try {
                    const res: any = await dailyApi.getDailyFeedback(child.id, ds)
                    console.log('>>> API返回:', JSON.stringify(res))
                    const records = res.data
                    const hasValidData = Array.isArray(records) && records.length > 0
                    if (hasValidData) {
                      const record = records[0]
                      // 映射字段：API 返回 mood_status/sleep_status，前端展示 emotion/nap_rating
                      setAttendanceDayFeedback({
                        emotion: record.mood_status ? Number(record.mood_status) : 0,
                        meal_status: record.meal_status ? Number(record.meal_status) : 0,
                        nap_rating: record.sleep_status ? Number(record.sleep_status) : 0,
                        notes: record.notes || '',
                      })
                    } else {
                      setAttendanceDayFeedback(null)
                    }
                  } catch (e) {
                    console.log('>>> API请求失败:', e)
                    setAttendanceDayFeedback(null)
                  }
                }

                const renderStatusBadge = (status: string) => {
                  if (status === 'full') {
                    return (
                      <View className="self-center">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#52C41A', border: '1px solid #52C41A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>
                          全天
                        </Text>
                      </View>
                    )
                  }
                  if (status === 'half') {
                    return (
                      <View className="self-center">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#73C974', border: '1px solid #52C41A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>
                          半天
                        </Text>
                      </View>
                    )
                  }
                  if (status === 'leave') {
                    return (
                      <View className="self-center">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#E53333', border: '1px solid #E53333', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>
                          请假
                        </Text>
                      </View>
                    )
                  }
                  if (status === 'absent') {
                    return (
                      <View className="self-center">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#D4A017', border: '1px solid #D4A017', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>
                          缺勤
                        </Text>
                      </View>
                    )
                  }
                  return null
                }

                return (
                  <View>
                    {/* 月份切换 */}
                    <View className="flex items-center justify-between mb-3 px-1">
                      <View
                        onClick={() => {
                          if (calDisplayMonth === 1) {
                            setCalDisplayYear(calDisplayYear - 1)
                            setCalDisplayMonth(12)
                          } else {
                            setCalDisplayMonth(calDisplayMonth - 1)
                          }
                        }}
                        style={{ width: 36, height: 36 }}
                        className="flex items-center justify-center rounded-full"
                      >
                        <Text style={{ color: '#333', fontSize: 20, lineHeight: '20px' }}>‹</Text>
                      </View>
                      <Text className="text-base font-semibold text-gray-700">
                        {calDisplayYear}年{calDisplayMonth}月
                      </Text>
                      <View
                        onClick={() => {
                          if (calDisplayMonth === 12) {
                            setCalDisplayYear(calDisplayYear + 1)
                            setCalDisplayMonth(1)
                          } else {
                            setCalDisplayMonth(calDisplayMonth + 1)
                          }
                        }}
                        style={{ width: 36, height: 36 }}
                        className="flex items-center justify-center rounded-full"
                      >
                        <Text style={{ color: '#333', fontSize: 20, lineHeight: '20px' }}>›</Text>
                      </View>
                    </View>

                    {/* 星期标题 */}
                    <View className="flex mb-1 px-1 py-1">
                      {['日', '一', '二', '三', '四', '五', '六'].map(w => (
                        <Text key={w} className="flex-1 text-center text-base text-amber-700 font-semibold py-1">
                          {w}
                        </Text>
                      ))}
                    </View>

                    {/* 日期网格 */}
                    <View className="flex flex-wrap px-1 pt-1 pb-2">
                      {Array.from({ length: startDow }).map((_, i) => (
                        <View key={`empty-${i}`} className="w-[14.28%] h-14" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1
                        const ds = `${displayYear}-${String(displayMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const status = attendanceMap[ds]
                        const inRange = ds >= startDate && ds <= endDate
                        return (
                          <View
                            key={d}
                            onClick={() => handleDayClick(d)}
                            className="w-[14.28%] h-14 flex flex-col items-center justify-start pt-1"
                          >
                            <View className={getTextWrapperClass(ds)}>
                              <Text className={`text-lg ${getDayClass(ds)}`}>{d}</Text>
                            </View>
                            {status && inRange && !holidayMap[ds] && renderStatusBadge(status)}
                            {holidayMap[ds] && inRange && (
                              <View className="self-center">
                                <Text className="text-sm px-1 rounded-sm" style={{ color: '#E8651A', border: '1px solid #E8651A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>
                                  放假
                                </Text>
                              </View>
                            )}
                          </View>
                        )
                      })}
                    </View>

                    {/* 图例 */}
                    <View className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 px-1">
                      <View className="flex items-center gap-1">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#52C41A', border: '1px solid #52C41A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>全天</Text>
                        <Text className="text-sm text-gray-500">全天出勤</Text>
                      </View>
                      <View className="flex items-center gap-1">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#73C974', border: '1px solid #52C41A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>半天</Text>
                        <Text className="text-sm text-gray-500">半天出勤</Text>
                      </View>
                      <View className="flex items-center gap-1">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#E53333', border: '1px solid #E53333', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>请假</Text>
                        <Text className="text-sm text-gray-500">请假</Text>
                      </View>
                      <View className="flex items-center gap-1">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#D4A017', border: '1px solid #D4A017', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>缺勤</Text>
                        <Text className="text-sm text-gray-500">缺勤</Text>
                      </View>
                      <View className="flex items-center gap-1">
                        <Text className="text-sm px-1 rounded-sm" style={{ color: '#E8651A', border: '1px solid #E8651A', backgroundColor: '#FFF8F0', lineHeight: '16px' }}>放假</Text>
                        <Text className="text-sm text-gray-500">放假</Text>
                      </View>
                    </View>

                    {/* 底部说明 */}
                    <View className="mt-2 px-1">
                      <Text className="text-sm text-gray-400">点击任意日期查看当日日常记录详情</Text>
                    </View>
                  </View>
                )
              })()}
            </View>
          </View>
        </View>
      )}

      {/* ========== 日常记录详情弹窗 ========== */}
      {showAttendanceCalendar && currentAttendanceCalendar?.selectedDate && (
        <View
          className="fixed inset-0 z-[210] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setCurrentAttendanceCalendar(prev => prev ? { ...prev, selectedDate: undefined } : null)}
        >
          <View className="bg-white rounded-2xl w-[90%] max-w-sm flex flex-col overflow-hidden shadow-2xl" style={{ zIndex: 1 }} onClick={(e) => e.stopPropagation()}>
            <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-sm font-medium text-gray-700">
                {currentAttendanceCalendar?.selectedDate?.replace(/^\d{4}-(\d{2})-(\d{2})$/, '$1月$2日')}日常记录
              </Text>
              <View
                onClick={() => setCurrentAttendanceCalendar(prev => prev ? { ...prev, selectedDate: undefined } : null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100"
              >
                <Text className="text-gray-500 text-base leading-none">✕</Text>
              </View>
            </View>
            <View className="p-4">
              {attendanceDayFeedback ? (
                <View className="space-y-3">
                  {attendanceDayFeedback.emotion ? (
                    <View className="flex items-center gap-2">
                      <Text className="text-xs text-gray-500 w-12">情绪</Text>
                      <View className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Text key={i} className={`text-sm ${i <= (attendanceDayFeedback.emotion || 0) ? 'text-yellow-400' : 'text-gray-300'}`}>★</Text>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {attendanceDayFeedback.meal_status ? (
                    <View className="flex items-center gap-2">
                      <Text className="text-xs text-gray-500 w-12">餐食</Text>
                      <View className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Text key={i} className={`text-sm ${i <= (attendanceDayFeedback.meal_status || 0) ? 'text-yellow-400' : 'text-gray-300'}`}>★</Text>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {attendanceDayFeedback.nap_rating && (
                    <View className="flex items-center gap-2">
                      <Text className="text-xs text-gray-500 w-12">午睡</Text>
                      <View className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Text key={i} className={`text-sm ${i <= (attendanceDayFeedback.nap_rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}>★</Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {attendanceDayFeedback.notes && (
                    <View>
                      <Text className="text-xs text-gray-500 mb-1">备注</Text>
                      <Text className="text-sm text-gray-700 leading-relaxed">{attendanceDayFeedback.notes}</Text>
                    </View>
                  )}
                  {!attendanceDayFeedback.emotion && !attendanceDayFeedback.meal_status &&
                   !attendanceDayFeedback.nap_rating && !attendanceDayFeedback.notes && (
                    <Text className="text-sm text-gray-400 text-center py-4">暂无日常记录</Text>
                  )}
                </View>
              ) : (
                <Text className="text-sm text-gray-400 text-center py-4">暂无日常记录</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
