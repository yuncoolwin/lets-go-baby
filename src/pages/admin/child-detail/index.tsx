import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { childrenApi, enrollmentApi, classApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Pencil, Trash2, BookOpen, Plus } from 'lucide-react-taro'
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

const courseTypeOptions = ['全日托', '半日托', '周六托', '晚间托', '兴趣班']
const durationTypeOptions = ['一周体验', '1个月', '3个月', '6个月', '12个月', '计日']
const paymentChannelOptions = ['微信', '支付宝', '现金']

const calculateAge = formatAge

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ChildDetailPage() {
  const router = useRouter()
  const { id } = router.params
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])

  // 报读表单弹窗
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<any | null>(null)
  const [formCourseType, setFormCourseType] = useState('')
  const [formDurationType, setFormDurationType] = useState('')
  const [formDurationDays, setFormDurationDays] = useState('')
  const [formStartDate, setFormStartDate] = useState(todayStr())
  const [formEndDate, setFormEndDate] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formStatus, setFormStatus] = useState('进行中')
  const [formPaymentAmount, setFormPaymentAmount] = useState('')
  const [formPaymentChannel, setFormPaymentChannel] = useState('')
  const [savingEnrollment, setSavingEnrollment] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [childRes, enrRes, clsRes] = await Promise.all([
        childrenApi.detail(id),
        enrollmentApi.list(id!),
        classApi.list(),
      ])
      if (childRes.code === 200 && childRes.data) {
        setChild(childRes.data as unknown as ChildDetail)
      } else {
        Taro.showToast({ title: childRes.msg || '加载失败', icon: 'none' })
      }
      if (enrRes.code === 200 && Array.isArray(enrRes.data)) {
        setEnrollments(enrRes.data as any[])
        if (clsRes.code === 200 && Array.isArray(clsRes.data)) { setClasses(clsRes.data as any[]) }
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
          setDeleting(true)
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
          } finally {
            setDeleting(false)
          }
        }
      },
    })
  }

  // 计算结束日期
  const calcEndDate = useCallback(async () => {
    if (!formStartDate || !formCourseType || !formDurationType) {
      setFormEndDate('')
      return
    }
    try {
      const res = await childrenApi.calcEndDate({
        start_date: formStartDate,
        course_type: formCourseType,
        enrollment_duration: formDurationType,
        custom_days: formDurationType === '计日' ? formDurationDays : '',
      })
      if (res.code === 200 && res.data?.end_date) {
        setFormEndDate(res.data.end_date)
      }
    } catch {
      // 静默失败
    }
  }, [formStartDate, formCourseType, formDurationType, formDurationDays])

  useEffect(() => {
    calcEndDate()
  }, [calcEndDate])

  // 打开新增报读
  const openAddEnrollment = () => {
    setEditingEnrollment(null)
    setFormCourseType('')
    setFormDurationType('')
    setFormDurationDays('')
    setFormStartDate(todayStr())
    setFormEndDate('')
    setFormClassId(child?.class_id || '')
    setFormStatus('进行中')
    setFormPaymentAmount('')
    setFormPaymentChannel('')
    setShowEnrollmentDialog(true)
  }

  // 打开编辑报读
  const openEditEnrollment = (enr: any) => {
    setEditingEnrollment(enr)
    setFormCourseType(enr.course_type || '')
    setFormDurationType(enr.duration_type || '')
    setFormDurationDays(enr.duration_days ? String(enr.duration_days) : '')
    setFormStartDate(enr.start_date || todayStr())
    setFormEndDate(enr.end_date || '')
    setFormClassId(enr.class_id || child?.class_id || '')
    setFormStatus(enr.status || '进行中')
    setFormPaymentAmount(enr.payment_amount || '')
    setFormPaymentChannel(enr.payment_channel || '')
    setShowEnrollmentDialog(true)
  }

  // 提交报读
  const handleSubmitEnrollment = async () => {
    if (!formCourseType || !formDurationType) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    setSavingEnrollment(true)
    try {
      const payload: any = {
        child_id: id,
        course_type: formCourseType,
        duration_type: formDurationType,
        duration_days: formDurationType === '计日' ? Number(formDurationDays) || 0 : 0,
        start_date: formStartDate,
        end_date: formEndDate,
        status: formStatus,
        payment_amount: formPaymentAmount || null,
        payment_channel: formPaymentChannel || null,
        class_id: formClassId,
      }
      if (editingEnrollment) {
        const res = await enrollmentApi.update(editingEnrollment.id, payload)
        if (res.code === 200) {
          Taro.showToast({ title: '修改成功', icon: 'success' })
          setShowEnrollmentDialog(false)
          loadData()
        } else {
          Taro.showToast({ title: res.msg || '修改失败', icon: 'none' })
        }
      } else {
        const res = await enrollmentApi.create(payload)
        if (res.code === 200) {
          Taro.showToast({ title: '新增成功', icon: 'success' })
          setShowEnrollmentDialog(false)
          loadData()
        } else {
          Taro.showToast({ title: res.msg || '新增失败', icon: 'none' })
        }
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setSavingEnrollment(false)
    }
  }

  // 删除报读
  const handleDeleteEnrollment = (enr: any) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除此报读记录吗？`,
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
            <View className="flex items-center gap-4 mb-4">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full" mode="aspectFit" />
              <View className="flex-1">
                <View className="flex items-center gap-2">
                  <Text className="text-xl font-bold text-foreground">{child.name}</Text>
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
                </View>
                <Text className="block text-sm text-muted-foreground mt-1">
                  {child.gender === 'male' ? '男' : '女'} · {calculateAge(child.birth_date)}
                </Text>
              </View>
            </View>

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
              <Button
                className="bg-primary text-white rounded-lg h-8 px-3"
                onClick={openAddEnrollment}
              >
                <View className="flex items-center gap-1">
                  <Plus size={14} color="#fff" />
                  <Text className="text-xs text-white">新增报读</Text>
                </View>
              </Button>
            </View>
            {enrollments.length === 0 ? (
              <View className="py-8 flex flex-col items-center">
                <Text className="text-sm text-gray-400">暂无报读记录</Text>
                <Text className="block text-xs text-gray-300 mt-1">点击上方按钮新增报读</Text>
              </View>
            ) : (
              enrollments.map((enr) => (
                <View
                  key={enr.id}
                  className="bg-gray-50 rounded-xl p-3 mb-2"
                >
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-sm font-semibold text-foreground">{enr.course_type}</Text>
                    <View className="flex items-center gap-2">
                      <Badge className={enr.status === '进行中' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        <Text className="text-xs">{enr.status}</Text>
                      </Badge>
                      <Pencil
                        size={14}
                        color="#999"
                        onClick={() => openEditEnrollment(enr)}
                      />
                      <Trash2
                        size={14}
                        color="#ef4444"
                        onClick={() => handleDeleteEnrollment(enr)}
                      />
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

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <Button
            className="flex-1 bg-primary text-white rounded-xl"
            onClick={() => Taro.navigateTo({ url: `/pages/admin/child-edit/index?id=${child.id}` })}
          >
            <View className="flex items-center justify-center gap-2">
              <Pencil size={16} color="#fff" />
              <Text className="text-white">编辑</Text>
            </View>
          </Button>
          <Button
            className="flex-1 bg-red-500 text-white rounded-xl"
            onClick={handleDelete}
            disabled={deleting}
          >
            <View className="flex items-center justify-center gap-2">
              <Trash2 size={16} color="#fff" />
              <Text className="text-white">{deleting ? '删除中...' : '删除'}</Text>
            </View>
          </Button>
        </View>
      </View>

      {/* 报读表单弹窗 */}
      {showEnrollmentDialog && (
        <View
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,248,240,0.9)' }}
          onClick={() => setShowEnrollmentDialog(false)}
        >
          <View
            className="bg-white rounded-2xl w-[90%] max-h-[85vh] overflow-y-auto"
            onClick={(e) => { e.stopPropagation() }}
          >
            <View className="p-5">
              <View className="flex items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-foreground">
                  {editingEnrollment ? '编辑报读' : '新增报读'}
                </Text>
                <Text
                  className="text-sm text-gray-400"
                  onClick={() => setShowEnrollmentDialog(false)}
                >
                  关闭
                </Text>
              </View>

              <View className="space-y-4">
                {/* 课程类型 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">课程类型</Text>
                  <View className="flex flex-wrap gap-2">
                    {courseTypeOptions.map((opt) => (
                      <View
                        key={opt}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          formCourseType === opt
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                        onClick={() => {
                          setFormCourseType(opt)
                          if (['周六托', '兴趣班'].includes(opt)) {
                            setFormDurationType('计日')
                          }
                        }}
                      >
                        <Text>{opt}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 报读时长 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">报读时长</Text>
                  <View className="flex flex-wrap gap-2">
                    {durationTypeOptions.map((opt) => {
                      const disabled = ['周六托', '兴趣班'].includes(formCourseType) && opt !== '计日'
                      return (
                        <View
                          key={opt}
                          className={`px-3 py-1.5 rounded-lg text-sm ${
                            disabled ? 'bg-gray-100 text-gray-300'
                            : formDurationType === opt
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                          onClick={() => {
                            if (!disabled) {
                              setFormDurationType(opt)
                              if (opt !== '计日') setFormDurationDays('')
                            }
                          }}
                        >
                          <Text>{opt}</Text>
                        </View>
                      )
                    })}
                  </View>
                  {formDurationType === '计日' && (
                    <View className="mt-2">
                      <View className="bg-gray-50 rounded-xl px-4 py-3">
                        <Input
                          className="w-full bg-transparent"
                          type="number"
                          placeholder="请输入天数"
                          value={formDurationDays}
                          onInput={(e) => setFormDurationDays(e.detail.value)}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* 开始日期 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">开始日期</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Picker mode="date" value={formStartDate} onChange={(e) => setFormStartDate(e.detail.value)}>
                      <Text className={formStartDate ? 'text-foreground' : 'text-gray-400'}>
                        {formStartDate || '请选择日期'}
                      </Text>
                    </Picker>
                  </View>
                </View>

                {/* 结束日期 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">结束日期</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Text className="text-gray-500">{formEndDate || '自动计算中...'}</Text>
                  </View>
                </View>

                {/* 所在班级 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">所在班级</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Picker
                      mode="selector"
                      range={classes.map((c: any) => `${c.name}${c.room ? `（${c.room}）` : ''}`)}
                      value={classes.findIndex((c: any) => c.id === formClassId)}
                      onChange={(e) => {
                        const idx = parseInt(e.detail.value, 10)
                        if (idx >= 0 && idx < classes.length) {
                          setFormClassId(classes[idx].id)
                        }
                      }}
                    >
                      <Text className={formClassId ? 'text-foreground' : 'text-gray-400'}>
                        {formClassId
                          ? (() => {
                              const cls = classes.find((c: any) => c.id === formClassId)
                              return cls ? `${cls.name}${cls.room ? `（${cls.room}）` : ''}` : '请选择班级'
                            })()
                          : '请选择班级'}
                      </Text>
                    </Picker>
                  </View>
                </View>

                {/* 状态 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">状态</Text>
                  <View className="flex gap-2">
                    <View
                      className={`px-4 py-1.5 rounded-lg text-sm ${
                        formStatus === '进行中' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => setFormStatus('进行中')}
                    >
                      <Text>进行中</Text>
                    </View>
                    <View
                      className={`px-4 py-1.5 rounded-lg text-sm ${
                        formStatus === '已结束' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => setFormStatus('已结束')}
                    >
                      <Text>已结束</Text>
                    </View>
                  </View>
                </View>

                {/* 缴费记录 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">缴费记录</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      type="digit"
                      placeholder="输入缴费金额（元）"
                      value={formPaymentAmount}
                      onInput={(e) => setFormPaymentAmount(e.detail.value)}
                    />
                  </View>
                </View>

                {/* 缴费渠道 */}
                <View>
                  <Text className="block text-sm font-medium text-foreground mb-2">缴费渠道</Text>
                  <View className="flex flex-wrap gap-2">
                    {paymentChannelOptions.map((opt) => (
                      <View
                        key={opt}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          formPaymentChannel === opt
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                        onClick={() => setFormPaymentChannel(formPaymentChannel === opt ? '' : opt)}
                      >
                        <Text>{opt}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 提交按钮 */}
                <Button
                  className="w-full bg-primary text-white rounded-xl py-3"
                  onClick={handleSubmitEnrollment}
                  disabled={savingEnrollment}
                >
                  <Text className="text-white">{savingEnrollment ? '保存中...' : '保存'}</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}