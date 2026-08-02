import { useState, useEffect, useCallback } from 'react'
import { View, Text, Picker, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { childrenApi, classApi, enrollmentApi } from '@/utils/api'
import { Plus, Pencil, Trash2 } from 'lucide-react-taro'
import BackButton from '@/components/back-button'
import { Badge } from '@/components/ui/badge'

interface ClassItem {
  id: string
  name: string
  level: string
}

interface Enrollment {
  id: string
  child_id: string
  course_type: string
  duration_type: string
  duration_days: number
  start_date: string
  end_date: string
  class_id: string | null
  payment_amount: string | null
  payment_channel: string | null
  status: string
  created_at: string
}

const statusOptions = [
  { value: 'active', label: '在读' },
  { value: 'graduated', label: '毕业' },
  { value: 'suspended', label: '休学' },
]

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

const courseTypeOptions = ['全日托', '半日托', '周六托', '晚间托', '兴趣班']

const durationOptions = [
  { value: '一周体验', label: '一周体验' },
  { value: '1个月', label: '1个月' },
  { value: '3个月', label: '3个月' },
  { value: '6个月', label: '6个月' },
  { value: '12个月', label: '12个月' },
  { value: '计日', label: '计日' },
]

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export default function ChildEditPage() {
  const router = useRouter()
  const { id } = router.params
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [classes, setClasses] = useState<ClassItem[]>([])

  // 幼儿基本信息
  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState('active')
  const [classId, setClassId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [healthInfo, setHealthInfo] = useState('')

  // 报读记录
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])

  // 报读表单弹窗
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [formCourseType, setFormCourseType] = useState('')
  const [formDurationType, setFormDurationType] = useState('')
  const [formDurationDays, setFormDurationDays] = useState('')
  const [formStartDate, setFormStartDate] = useState(todayStr())
  const [formEndDate, setFormEndDate] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formStatus, setFormStatus] = useState('进行中')
  const [formPaymentAmount, setFormPaymentAmount] = useState('')
  const [formPaymentChannel, setFormPaymentChannel] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // 删除确认弹窗
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null)

  // 加载报读列表
  const loadEnrollments = useCallback(async () => {
    if (!id) return
    try {
      const res = await enrollmentApi.list(id)
      if (res.code === 200 && Array.isArray(res.data)) {
        setEnrollments(res.data as Enrollment[])
      }
    } catch {
      // 静默
    }
  }, [id])

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [childRes, classRes] = await Promise.all([
        childrenApi.detail(id),
        classApi.list({ page: 1, page_size: 100 }),
      ])
      if (childRes.code === 200 && childRes.data) {
        const child = childRes.data as any
        setName(child.name || '')
        setGender(child.gender || 'male')
        setBirthDate(child.birth_date || '')
        setStatus(child.status || 'active')
        setClassId(child.class_id || '')
        setParentName(child.parent_name || '')
        setParentPhone(child.parent_phone || '')
        setAllergies(child.allergies || '')
        setHealthInfo(child.health_info || '')
      }
      if (classRes.code === 200 && classRes.data) {
        const classData = classRes.data as any
        setClasses(Array.isArray(classData.list) ? classData.list : [])
      }
      // 加载报读记录
      await loadEnrollments()
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id, loadEnrollments])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 计算结束日期
  const calcEndDate = useCallback(async () => {
    if (!formDurationType || !formStartDate) {
      setFormEndDate('')
      return
    }
    try {
      const res = await childrenApi.calcEndDate({
        course_type: formCourseType,
        enrollment_duration: formDurationType,
        start_date: formStartDate,
        custom_days: formDurationType === '计日' ? formDurationDays : undefined,
      })
      if (res.code === 200 && res.data?.end_date) {
        setFormEndDate(res.data.end_date)
      }
    } catch {
      // 静默
    }
  }, [formCourseType, formDurationType, formStartDate, formDurationDays])

  useEffect(() => {
    const timer = setTimeout(calcEndDate, 300)
    return () => clearTimeout(timer)
  }, [calcEndDate])

  // 打开新增报读弹窗
  const openAddEnrollment = () => {
    setEditingEnrollment(null)
    setFormCourseType('')
    setFormDurationType('')
    setFormDurationDays('')
    setFormStartDate(todayStr())
    setFormEndDate('')
    setFormClassId('')
    setFormStatus('进行中')
    setFormPaymentAmount('')
    setFormPaymentChannel('')
    setShowEnrollmentDialog(true)
  }

  // 打开编辑报读弹窗
  const openEditEnrollment = (enr: Enrollment) => {
    setEditingEnrollment(enr)
    setFormCourseType(enr.course_type)
    setFormDurationType(enr.duration_type)
    setFormDurationDays(enr.duration_days > 0 ? String(enr.duration_days) : '')
    setFormStartDate(enr.start_date || todayStr())
    setFormEndDate(enr.end_date || '')
    setFormClassId(enr.class_id || '')
    setFormStatus(enr.status)
    setFormPaymentAmount(enr.payment_amount || '')
    setFormPaymentChannel(enr.payment_channel || '')
    setShowEnrollmentDialog(true)
  }

  // 提交报读表单
  const handleSubmitEnrollment = async () => {
    if (!formCourseType) {
      Taro.showToast({ title: '请选择课程类型', icon: 'none' })
      return
    }
    if (!formDurationType) {
      Taro.showToast({ title: '请选择报读时长', icon: 'none' })
      return
    }
    if (formDurationType === '计日' && !formDurationDays) {
      Taro.showToast({ title: '请输入天数', icon: 'none' })
      return
    }
    if (!formStartDate) {
      Taro.showToast({ title: '请选择开始日期', icon: 'none' })
      return
    }

    setFormSubmitting(true)
    try {
      const payload: Record<string, any> = {
        child_id: id,
        course_type: formCourseType,
        duration_type: formDurationType,
        duration_days: formDurationType === '计日' ? parseInt(formDurationDays) || 0 : 0,
        start_date: formStartDate,
        end_date: formEndDate || undefined,
        class_id: formClassId || undefined,
        payment_amount: formPaymentAmount || undefined,
        payment_channel: formPaymentChannel || undefined,
        status: formStatus,
      }

      if (editingEnrollment) {
        const res = await enrollmentApi.update(editingEnrollment.id, payload)
        if (res.code === 200) {
          Taro.showToast({ title: '更新成功', icon: 'success' })
          setShowEnrollmentDialog(false)
          loadEnrollments()
        } else {
          Taro.showToast({ title: res.msg || '更新失败', icon: 'none' })
        }
      } else {
        const res = await enrollmentApi.create(payload)
        if (res.code === 200) {
          Taro.showToast({ title: '新增成功', icon: 'success' })
          setShowEnrollmentDialog(false)
          loadEnrollments()
        } else {
          Taro.showToast({ title: res.msg || '新增失败', icon: 'none' })
        }
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setFormSubmitting(false)
    }
  }

  // 删除报读
  const handleDeleteEnrollment = async () => {
    if (!deletingEnrollmentId) return
    try {
      const res = await enrollmentApi.remove(deletingEnrollmentId)
      if (res.code === 200) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        setShowDeleteConfirm(false)
        setDeletingEnrollmentId(null)
        loadEnrollments()
      } else {
        Taro.showToast({ title: res.msg || '删除失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        gender,
        birth_date: birthDate,
        status,
        class_id: classId || undefined,
        parent_name: parentName || undefined,
        parent_phone: parentPhone || undefined,
        allergies: allergies || undefined,
        health_info: healthInfo || undefined,
      }
      const res = await childrenApi.update(id!, payload)
      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'none', duration: 3000 })
        setSubmitting(false)
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none', duration: 3000 })
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadgeClass = (enr: Enrollment) => {
    if (enr.status === '进行中') return 'bg-green-100 text-green-700'
    return 'bg-gray-100 text-gray-500'
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">编辑幼儿</Text>
      </View>

      <ScrollView className="p-4 space-y-4" scrollY>
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <Text className="text-base font-semibold text-foreground">基本信息</Text>

            {/* 姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">姓名 *</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入幼儿姓名"
                  value={name}
                  onInput={(e) => setName(e.detail.value)}
                />
              </View>
            </View>

            {/* 性别 */}
            <View>
              <Label className="text-sm font-medium text-foreground">性别 *</Label>
              <View className="mt-1 flex gap-2">
                {genderOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      gender === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setGender(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 出生日期 */}
            <View>
              <Label className="text-sm font-medium text-foreground">出生日期 *</Label>
              <Picker
                mode="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.detail.value)}
              >
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="text-sm text-foreground">
                    {birthDate || '请选择出生日期'}
                  </Text>
                </View>
              </Picker>
            </View>

            {/* 在读状态 */}
            <View>
              <Label className="text-sm font-medium text-foreground">在读状态 *</Label>
              <View className="mt-1 flex gap-2">
                {statusOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      status === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setStatus(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 过敏情况 */}
            <View>
              <Label className="text-sm font-medium text-foreground">过敏情况</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="无"
                  value={allergies}
                  onInput={(e) => setAllergies(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长姓名</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长姓名"
                  value={parentName}
                  onInput={(e) => setParentName(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长电话 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长电话</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长电话"
                  value={parentPhone}
                  onInput={(e) => setParentPhone(e.detail.value)}
                />
              </View>
            </View>

            {/* 健康信息 */}
            <View>
              <Label className="text-sm font-medium text-foreground">健康信息</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入健康信息"
                  value={healthInfo}
                  onInput={(e) => setHealthInfo(e.detail.value)}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 报读记录卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <View className="flex items-center justify-between">
              <Text className="text-base font-semibold text-foreground">报读记录</Text>
              <View className="flex-shrink-0">
                <Button
                  className="bg-primary text-white rounded-lg px-3 py-1 text-sm"
                  onClick={openAddEnrollment}
                >
                  <Plus size={16} color="white" className="mr-1" />
                  <Text className="text-white text-sm">新增报读</Text>
                </Button>
              </View>
            </View>

            {enrollments.length === 0 ? (
              <View className="py-8 flex items-center justify-center">
                <Text className="text-gray-400 text-sm">暂无报读记录</Text>
              </View>
            ) : (
              enrollments.map((enr) => (
                <View
                  key={enr.id}
                  className="bg-gray-50 rounded-xl p-3"
                >
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-2">
                      <Text className="text-sm font-semibold text-foreground">{enr.course_type}</Text>
                      <Badge className={getStatusBadgeClass(enr)}>
                        <Text className="text-xs">{enr.status}</Text>
                      </Badge>
                    </View>
                    <View className="flex items-center gap-2">
                      <View onClick={() => openEditEnrollment(enr)}>
                        <Pencil size={16} color="#666" />
                      </View>
                      <View
                        onClick={() => {
                          setDeletingEnrollmentId(enr.id)
                          setShowDeleteConfirm(true)
                        }}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </View>
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs text-gray-500">
                      时长：{enr.duration_type === '计日' ? `${enr.duration_days}天` : enr.duration_type}
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
                </View>
              ))
            )}
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <Text className="text-white">{submitting ? '保存中...' : '保存修改'}</Text>
        </Button>
      </ScrollView>

      {/* 新增/编辑报读弹窗 */}
      {showEnrollmentDialog && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <View className="bg-white rounded-2xl w-[90%] max-w-md max-h-[80vh] overflow-y-auto p-5">
            <View className="flex items-center justify-between mb-4">
              <Text className="text-base font-semibold text-foreground">
                {editingEnrollment ? '编辑报读' : '新增报读'}
              </Text>
              <View onClick={() => setShowEnrollmentDialog(false)}>
                <Text className="text-gray-400 text-lg">✕</Text>
              </View>
            </View>

            <View className="space-y-4">
              {/* 课程类型 */}
              <View>
                <Label className="text-sm font-medium text-foreground">课程类型 *</Label>
                <View className="mt-1 flex flex-wrap gap-2">
                  {courseTypeOptions.map((t) => (
                    <View
                      key={t}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        formCourseType === t ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                      }`}
                      onClick={() => {
                        setFormCourseType(t)
                        if ((t === '周六托' || t === '兴趣班') && formDurationType !== '计日') {
                          setFormDurationType('计日')
                        }
                      }}
                    >
                      <Text className="text-sm">{t}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 报读时长 */}
              <View>
                <Label className="text-sm font-medium text-foreground">报读时长 *</Label>
                <View className="mt-1 flex flex-wrap gap-2">
                  {durationOptions.map((opt) => {
                    const disabled = (formCourseType === '周六托' || formCourseType === '兴趣班') && opt.value !== '计日'
                    return (
                      <View
                        key={opt.value}
                        className={`px-4 py-2 rounded-lg text-sm ${
                          formDurationType === opt.value
                            ? 'bg-primary text-white'
                            : disabled
                              ? 'bg-gray-200 text-gray-400'
                              : 'bg-gray-100 text-foreground'
                        }`}
                        onClick={() => {
                          if (disabled) {
                            Taro.showToast({ title: '该课程类型仅支持自定义天数', icon: 'none' })
                            return
                          }
                          setFormDurationType(opt.value)
                          if (opt.value !== '计日') {
                            setFormDurationDays('')
                          }
                        }}
                      >
                        <Text className="text-sm">{opt.label}</Text>
                      </View>
                    )
                  })}
                </View>
                {formDurationType === '计日' && (
                  <View className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                    <Input
                      className="w-full bg-transparent text-sm"
                      placeholder="请输入天数"
                      value={formDurationDays}
                      onInput={(e) => setFormDurationDays(e.detail.value)}
                    />
                  </View>
                )}
              </View>

              {/* 开始日期 */}
              <View>
                <Label className="text-sm font-medium text-foreground">开始日期 *</Label>
                <Picker
                  mode="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.detail.value)}
                >
                  <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                    <Text className="text-sm text-foreground">
                      {formStartDate || '请选择开始日期'}
                    </Text>
                  </View>
                </Picker>
              </View>

              {/* 结束日期（只读） */}
              <View>
                <Label className="text-sm font-medium text-foreground">结束日期</Label>
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="text-sm text-foreground">
                    {formEndDate || '请先选择报读时长和开始日期'}
                  </Text>
                </View>
              </View>

              {/* 班级 */}
              <View>
                <Label className="text-sm font-medium text-foreground">所在班级</Label>
                <View className="mt-1 flex flex-wrap gap-2">
                  <View
                    className={`px-4 py-2 rounded-lg text-sm ${
                      !formClassId ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setFormClassId('')}
                  >
                    <Text className="text-sm">未分班</Text>
                  </View>
                  {classes.map((cls) => (
                    <View
                      key={cls.id}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        formClassId === cls.id ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                      }`}
                      onClick={() => setFormClassId(cls.id)}
                    >
                      <Text className="text-sm">{cls.name}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 状态 */}
              <View>
                <Label className="text-sm font-medium text-foreground">状态</Label>
                <View className="mt-1 flex gap-2">
                  {['进行中', '已结束'].map((s) => (
                    <View
                      key={s}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        formStatus === s ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                      }`}
                      onClick={() => setFormStatus(s)}
                    >
                      <Text className="text-sm">{s}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 缴费记录 */}
              <View>
                <Label className="text-sm font-medium text-foreground">缴费记录</Label>
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Input
                    className="w-full bg-transparent text-sm"
                    placeholder="请输入缴费金额"
                    value={formPaymentAmount}
                    onInput={(e) => setFormPaymentAmount(e.detail.value)}
                  />
                </View>
              </View>

              {/* 缴费渠道 */}
              <View>
                <Label className="text-sm font-medium text-foreground">缴费渠道</Label>
                <View className="mt-1 flex gap-2">
                  {['微信', '支付宝', '现金'].map((ch) => (
                    <View
                      key={ch}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        formPaymentChannel === ch ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                      }`}
                      onClick={() => setFormPaymentChannel(ch)}
                    >
                      <Text className="text-sm">{ch}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 提交按钮 */}
              <Button
                className="w-full bg-primary text-white rounded-xl py-3"
                onClick={handleSubmitEnrollment}
                disabled={formSubmitting}
              >
                <Text className="text-white">{formSubmitting ? '保存中...' : editingEnrollment ? '更新' : '新增'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <View className="bg-white rounded-2xl p-5 w-[80%] max-w-sm">
            <Text className="text-base font-semibold text-foreground mb-2">确认删除</Text>
            <Text className="text-sm text-gray-500 mb-4">确定要删除这条报读记录吗？</Text>
            <View className="flex gap-3">
              <Button
                className="flex-1 bg-gray-100 text-foreground rounded-xl py-2"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingEnrollmentId(null)
                }}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1 bg-red-500 text-white rounded-xl py-2"
                onClick={handleDeleteEnrollment}
              >
                <Text className="text-white">删除</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}