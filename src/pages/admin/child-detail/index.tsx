import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { childrenApi, enrollmentApi, classApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Pencil, Trash2, BookOpen, Plus, X, Check } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'

interface ChildDetail {
  id: string
  name: string
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

export default function ChildDetailPage() {
  const router = useRouter()
  const { id } = router.params
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

  // 基本信息编辑态
  const [editingBasicInfo, setEditingBasicInfo] = useState(false)
  const [formChildName, setFormChildName] = useState('')
  const [formChildGender, setFormChildGender] = useState('')
  const [formChildBirthDate, setFormChildBirthDate] = useState('')
  const [formChildAllergies, setFormChildAllergies] = useState('')
  const [formChildHealthInfo, setFormChildHealthInfo] = useState('')
  const [formChildParentName, setFormChildParentName] = useState('')
  const [formChildParentPhone, setFormChildParentPhone] = useState('')

  // 开始编辑基本信息
  const startEditBasicInfo = () => {
    if (!child) return
    setFormChildName(child.name)
    setFormChildGender(child.gender)
    setFormChildBirthDate(child.birth_date || '')
    setFormChildAllergies(child.allergies || '')
    setFormChildHealthInfo(child.health_info || '')
    setFormChildParentName(child.parent_name || '')
    setFormChildParentPhone(child.parent_phone || '')
    setEditingBasicInfo(true)
  }

  // 取消编辑基本信息
  const cancelEditBasicInfo = () => {
    setEditingBasicInfo(false)
  }

  // 保存基本信息
  const saveBasicInfo = async () => {
    if (!formChildName) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const result = await childrenApi.update(id!, {
        name: formChildName,
        gender: formChildGender,
        birth_date: formChildBirthDate,
        allergies: formChildAllergies || null,
        health_info: formChildHealthInfo || null,
        parent_name: formChildParentName || null,
        parent_phone: formChildParentPhone || null,
      })
      if (result.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setEditingBasicInfo(false)
        loadData()
      } else {
        Taro.showToast({ title: result.msg || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setSubmitting(false)
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
    setEditingEnrollment({ id: '__new__' }) // 使用特殊ID标记新增模式
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
  }

  // 关闭报读编辑表单
  const closeEnrollmentForm = () => {
    setEditingEnrollment(null)
    setFormCourseType('')
    setFormDurationType('计日')
    setFormDurationDays('')
    setFormStartDate('')
    setFormEndDate('')
    setFormStatus('进行中')
    setFormPaymentAmount('')
    setFormPaymentChannel('')
    setFormClassId('')
  }

  // 计算结束日期
  const calcEndDate = async (courseType: string, durationType: string, durationDays: string, startDate: string) => {
    if (!courseType || !durationType || !startDate) {
      setFormEndDate('')
      return
    }
    try {
      const res = await childrenApi.calcEndDate({
        course_type: courseType,
        enrollment_duration: durationType,
        custom_days: durationType === '计日' ? durationDays : '',
        start_date: startDate,
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
    if (!id) {
      Taro.showToast({ title: '幼儿ID无效', icon: 'none' })
      setSubmitting(false)
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
        duration_type: formDurationType,
        duration_days: formDurationType === '计日' ? (parseInt(formDurationDays) || 0) : 0,
        start_date: formStartDate,
        end_date: formEndDate || null,
        status: formStatus,
        payment_amount: formPaymentAmount || null,
        payment_channel: formPaymentChannel || null,
        class_id: formClassId || null,
      }
      let result
      if (editingEnrollment) {
        result = await enrollmentApi.update(editingEnrollment.id, payload)
      } else {
        result = await enrollmentApi.create(payload)
      }
      if (result.code === 200) {
        Taro.showToast({ title: editingEnrollment ? '修改成功' : '新增成功', icon: 'success' })
        closeEnrollmentForm()
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

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [childRes, enrRes, clsRes] = await Promise.all([
        childrenApi.detail(id),
        enrollmentApi.list(id!),
        classApi.list({ page: 1, page_size: 100 }),
      ])
      if (childRes.code === 200 && childRes.data) {
        setChild(childRes.data as unknown as ChildDetail)
      } else {
        Taro.showToast({ title: childRes.msg || '加载失败', icon: 'none' })
      }
      if (enrRes.code === 200 && Array.isArray(enrRes.data)) {
        setEnrollments(enrRes.data as any[])
      }
      if (clsRes.code === 200 && clsRes.data?.list && Array.isArray(clsRes.data.list)) {
        setClasses(clsRes.data.list)
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
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">幼儿详情</Text>
      </View>

      <View className="p-4 space-y-4">
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            {/* 卡片头部 */}
            <View className="flex items-start gap-4 mb-4">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full flex-shrink-0" mode="aspectFit" />
              <View className="flex-1">
                <View className="flex items-center gap-2">
                  {editingBasicInfo ? (
                    <View className="bg-gray-50 rounded-xl px-3 py-1 flex-1">
                      <Input
                        className="w-full bg-transparent text-xl font-bold"
                        placeholder="请输入姓名"
                        value={formChildName}
                        onInput={(e) => setFormChildName(e.detail.value)}
                      />
                    </View>
                  ) : (
                    <Text className="text-xl font-bold text-foreground">{child.name}</Text>
                  )}
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
                </View>
                {editingBasicInfo ? (
                  <View className="flex gap-2 mt-2">
                    <View
                      className={`px-3 py-1 rounded-lg text-sm ${formChildGender === 'male' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormChildGender('male')}
                    >
                      <Text>男</Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-lg text-sm ${formChildGender === 'female' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormChildGender('female')}
                    >
                      <Text>女</Text>
                    </View>
                  </View>
                ) : (
                  <Text className="block text-sm text-muted-foreground mt-1">
                    {child.gender === 'male' ? '男' : '女'} · {calculateAge(child.birth_date)}
                  </Text>
                )}
              </View>
              {editingBasicInfo ? (
                <View className="flex items-center gap-2 flex-shrink-0 pt-1">
                  <View onClick={cancelEditBasicInfo}>
                    <X size={18} color="#999" />
                  </View>
                  <View onClick={saveBasicInfo}>
                    <Check size={18} color="#E8651A" />
                  </View>
                </View>
              ) : (
                <View className="flex items-center gap-3 flex-shrink-0 pt-1">
                  <View onClick={startEditBasicInfo}>
                    <Pencil size={18} color="#999" />
                  </View>
                  <View onClick={handleDelete}>
                    <Trash2 size={18} color="#E8651A" />
                  </View>
                </View>
              )}
            </View>

            {/* 基本信息内容/编辑表单 */}
            {editingBasicInfo ? (
              <View className="space-y-3">
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">出生日期</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Picker
                      mode="date"
                      value={formChildBirthDate}
                      onChange={(e) => setFormChildBirthDate(e.detail.value)}
                    >
                      <Text className={formChildBirthDate ? '' : 'text-gray-400'}>
                        {formChildBirthDate || '请选择出生日期'}
                      </Text>
                    </Picker>
                  </View>
                </View>
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">过敏情况</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入过敏情况"
                      value={formChildAllergies}
                      onInput={(e) => setFormChildAllergies(e.detail.value)}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">健康信息</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入健康信息"
                      value={formChildHealthInfo}
                      onInput={(e) => setFormChildHealthInfo(e.detail.value)}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">家长姓名</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入家长姓名"
                      value={formChildParentName}
                      onInput={(e) => setFormChildParentName(e.detail.value)}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-1">家长电话</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      type="text"
                      placeholder="请输入家长电话"
                      value={formChildParentPhone}
                      onInput={(e) => setFormChildParentPhone(e.detail.value)}
                    />
                  </View>
                </View>
                <Button
                  className="w-full bg-primary text-primary-foreground rounded-xl py-3 mt-2"
                  onClick={saveBasicInfo}
                  disabled={submitting}
                >
                  <Text>{submitting ? '保存中...' : '保存基本信息'}</Text>
                </Button>
              </View>
            ) : (
              <View className="space-y-3">
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
              </View>
            )}
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
              {!editingEnrollment && (
                <Button className="h-8 px-3 bg-primary text-white rounded-lg" onClick={openAddEnrollment}>
                  <View className="flex items-center gap-1">
                    <Plus size={14} color="#fff" />
                    <Text className="text-xs text-white">新增报读</Text>
                  </View>
                </Button>
              )}
            </View>

            {/* 报读编辑表单（卡片内展开） */}
            {editingEnrollment && (
              <View className="bg-gray-50 rounded-xl p-4 mb-3 border border-primary">
                <View className="flex items-center justify-between mb-3">
                  <Text className="text-sm font-semibold text-primary">
                    {editingEnrollment.id === '__new__' ? '新增报读' : '编辑报读'}
                  </Text>
                  <View onClick={closeEnrollmentForm}>
                    <X size={18} color="#666" />
                  </View>
                </View>
                <View className="space-y-3">
                  <View>
                    <Text className="block text-xs font-medium text-foreground mb-1">课程类型</Text>
                    <View className="flex flex-wrap gap-2">
                      {['全日托', '半日托', '周六托', '晚间托', '兴趣班'].map((t) => (
                        <View
                          key={t}
                          className={`px-2 py-1 rounded-lg text-xs ${
                            formCourseType === t
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white text-gray-600'
                          }`}
                          onClick={() => {
                            const newType = t
                            setFormCourseType(newType)
                            if (['周六托', '兴趣班'].includes(newType)) {
                              setFormDurationType('计日')
                              setFormDurationDays('')
                              calcEndDate(newType, '计日', '', formStartDate)
                            } else {
                              calcEndDate(newType, formDurationType, formDurationDays, formStartDate)
                            }
                          }}
                        >
                          <Text>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs font-medium text-foreground mb-1">报读时长</Text>
                    <View className="flex flex-wrap gap-2">
                      {['一周体验', '1个月', '3个月', '6个月', '12个月', '计日'].map((t) => {
                        const disabled = ['周六托', '兴趣班'].includes(formCourseType) && t !== '计日'
                        return (
                          <View
                            key={t}
                            className={`px-2 py-1 rounded-lg text-xs ${
                              disabled ? 'bg-gray-100 text-gray-300' : formDurationType === t ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600'
                            }`}
                            onClick={() => {
                              if (!disabled) {
                                const newDuration = t
                                setFormDurationType(newDuration)
                                setFormDurationDays('')
                                calcEndDate(formCourseType, newDuration, '', formStartDate)
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
                      <Text className="block text-xs font-medium text-foreground mb-1">计日天数</Text>
                      <View className="bg-white rounded-lg px-3 py-2">
                        <Input
                          className="w-full bg-transparent text-sm"
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
                  <View className="flex gap-3">
                    <View className="flex-1">
                      <Text className="block text-xs font-medium text-foreground mb-1">开始日期</Text>
                      <View className="bg-white rounded-lg px-3 py-2">
                        <Picker
                          mode="date"
                          value={formStartDate}
                          onChange={(e) => {
                            const newDate = e.detail.value
                            setFormStartDate(newDate)
                            calcEndDate(formCourseType, formDurationType, formDurationDays, newDate)
                          }}
                        >
                          <Text className={`text-sm ${formStartDate ? '' : 'text-gray-400'}`}>
                            {formStartDate || '请选择'}
                          </Text>
                        </Picker>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-xs font-medium text-foreground mb-1">结束日期</Text>
                      <View className="bg-white rounded-lg px-3 py-2">
                        <Text className="text-sm text-gray-500">{formEndDate || '自动计算'}</Text>
                      </View>
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs font-medium text-foreground mb-1">所在班级</Text>
                    <View className="flex flex-wrap gap-2">
                      <View
                        className={`px-2 py-1 rounded-lg text-xs ${
                          !formClassId
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-white text-gray-600'
                        }`}
                        onClick={() => setFormClassId('')}
                      >
                        <Text>未分班</Text>
                      </View>
                      {classes.map((c: any) => (
                        <View
                          key={c.id}
                          className={`px-2 py-1 rounded-lg text-xs ${
                            formClassId === c.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white text-gray-600'
                          }`}
                          onClick={() => setFormClassId(c.id)}
                        >
                          <Text>{c.name}{c.room ? `（${c.room}）` : ''}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs font-medium text-foreground mb-1">状态</Text>
                    <View className="flex gap-2">
                      {['进行中', '已结束'].map((s) => (
                        <View
                          key={s}
                          className={`px-3 py-1 rounded-lg text-xs ${
                            formStatus === s ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600'
                          }`}
                          onClick={() => setFormStatus(s)}
                        >
                          <Text>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View className="flex gap-3">
                    <View className="flex-1">
                      <Text className="block text-xs font-medium text-foreground mb-1">缴费金额</Text>
                      <View className="bg-white rounded-lg px-3 py-2">
                        <Input
                          className="w-full bg-transparent text-sm"
                          type="number"
                          placeholder="金额"
                          value={formPaymentAmount}
                          onInput={(e) => setFormPaymentAmount(e.detail.value)}
                        />
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-xs font-medium text-foreground mb-1">缴费渠道</Text>
                      <View className="flex flex-wrap gap-1">
                        {['微信', '支付宝', '现金'].map((c) => (
                          <View
                            key={c}
                            className={`px-2 py-1 rounded-lg text-xs ${
                              formPaymentChannel === c ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600'
                            }`}
                            onClick={() => setFormPaymentChannel(c)}
                          >
                            <Text>{c}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <Button
                    className="w-full bg-primary text-primary-foreground rounded-lg py-2"
                    onClick={handleSubmitEnrollment}
                    disabled={submitting}
                  >
                    <Text>{submitting ? '保存中...' : '保存报读'}</Text>
                  </Button>
                </View>
              </View>
            )}

            {enrollments.length === 0 && !editingEnrollment ? (
              <View className="py-8 flex items-center justify-center">
                <Text className="text-sm text-muted-foreground">暂无报读记录，点击&quot;新增报读&quot;添加</Text>
              </View>
            ) : (
              enrollments.map((enr) => (
                <View
                  key={enr.id}
                  className={`bg-gray-50 rounded-xl p-3 mb-2 ${editingEnrollment?.id === enr.id ? 'border-2 border-primary' : ''}`}
                >
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-sm font-semibold text-foreground">{enr.course_type}</Text>
                    <View className="flex items-center gap-2">
                      {editingEnrollment?.id !== enr.id && (
                        <View onClick={() => openEditEnrollment(enr)}>
                          <Pencil size={14} color="#999" />
                        </View>
                      )}
                      <View onClick={() => handleDeleteEnrollment(enr)}>
                        <Trash2 size={14} color="#999" />
                      </View>
                      <Badge className={enr.status === '进行中' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        <Text className="text-xs">{enr.status}</Text>
                      </Badge>
                    </View>
                  </View>
                  <Text className="block text-xs text-gray-500">
                    时长：{enr.duration_type === '计日' ? `${enr.duration_days}天` : enr.duration_type}
                  </Text>
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
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </View>
    </View>
  )
}
