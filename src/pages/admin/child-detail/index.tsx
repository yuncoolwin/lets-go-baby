import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, X } from 'lucide-react-taro'
import { Network } from '@/network'
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
  created_at: string
  class_info?: {
    id: string
    name: string
    level: string
    room: string
  } | null
}

interface Enrollment {
  id: string
  child_id: string
  course_type: string
  duration_type: string
  duration_days: number
  start_date: string
  end_date: string
  status: string
  payment_amount: string
  payment_channel: string
  class_id: string
}

const statusMap: Record<string, { label: string; className: string }> = {
  在读: { label: '在读', className: 'bg-green-100 text-green-700' },
  离园: { label: '离园', className: 'bg-gray-100 text-gray-500' },
  '预报名': { label: '预报名', className: 'bg-blue-100 text-blue-700' },
}

const genderMap: Record<string, string> = { male: '男', female: '女' }

const COURSE_TYPES = ['全日托', '半日托', '周六托', '晚间托', '兴趣班']
const DURATION_OPTIONS = ['一周体验', '1个月', '3个月', '6个月', '12个月', '计日']
const PAYMENT_CHANNELS = ['微信', '支付宝', '现金']

export default function ChildDetail() {
  const router = Taro.getCurrentInstance().router
  const childId = router?.params?.id || ''

  const [child, setChild] = useState<ChildDetail | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [editCard, setEditCard] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // Enrollment form state
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [formCourseType, setFormCourseType] = useState('')
  const [formDurationType, setFormDurationType] = useState('')
  const [formDurationDays, setFormDurationDays] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formStatus, setFormStatus] = useState('进行中')
  const [formPaymentAmount, setFormPaymentAmount] = useState('')
  const [formPaymentChannel, setFormPaymentChannel] = useState('')

  useEffect(() => {
    if (childId) {
      loadData()
    }
  }, [childId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [childRes, enrollRes] = await Promise.all([
        Network.request<{ data: ChildDetail }>({ url: `/api/children/${childId}` }),
        Network.request<{ data: Enrollment[] }>({ url: `/api/enrollments/child/${childId}` }),
      ])
      console.log('[child-detail] child:', childRes.data)
      console.log('[child-detail] enrollments:', enrollRes.data)
      setChild(childRes.data.data)
      setEnrollments(enrollRes.data.data || [])
    } catch (err) {
      console.error('[child-detail] load error:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // --- Inline Edit Handlers ---
  const startEdit = (card: string) => {
    if (!child) return
    setEditCard(card)
    if (card === 'basic') {
      setEditValues({ status: child.status })
    } else if (card === 'contact') {
      setEditValues({
        parent_name: child.parent_name || '',
        parent_phone: child.parent_phone || '',
        allergies: child.allergies || '',
        health_info: child.health_info || '',
      })
    }
  }

  const cancelEdit = () => {
    setEditCard(null)
    setEditValues({})
  }

  const saveEdit = async () => {
    if (!child) return
    try {
      const res = await Network.request({
        url: `/api/children/${childId}`,
        method: 'PATCH',
        data: editValues,
      })
      console.log('[child-detail] save result:', res.data)
      setChild({ ...child, ...editValues })
      setEditCard(null)
      setEditValues({})
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('[child-detail] save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // --- Enrollment CRUD ---
  const openAddEnrollment = () => {
    const today = new Date().toISOString().split('T')[0]
    setEditingEnrollment(null)
    setFormCourseType('')
    setFormDurationType('')
    setFormDurationDays('')
    setFormStartDate(today)
    setFormEndDate('')
    setFormStatus('进行中')
    setFormPaymentAmount('')
    setFormPaymentChannel('')
    setShowEnrollmentForm(true)
  }

  const openEditEnrollment = (enr: Enrollment) => {
    setEditingEnrollment(enr)
    setFormCourseType(enr.course_type)
    setFormDurationType(enr.duration_type)
    setFormDurationDays(enr.duration_days ? String(enr.duration_days) : '')
    setFormStartDate(enr.start_date || '')
    setFormEndDate(enr.end_date || '')
    setFormStatus(enr.status)
    setFormPaymentAmount(enr.payment_amount || '')
    setFormPaymentChannel(enr.payment_channel || '')
    setShowEnrollmentForm(true)
  }

  const closeEnrollmentForm = () => {
    setShowEnrollmentForm(false)
    setEditingEnrollment(null)
  }

  const handleCalcEndDate = async () => {
    if (!formStartDate || !formCourseType) return
    try {
      const durationType = formDurationType
      const isSaturdayOnly = ['周六托', '兴趣班'].includes(formCourseType)
      const payload: Record<string, string> = {
        start_date: formStartDate,
        course_type: formCourseType,
      }
      if (durationType === '计日') {
        payload.enrollment_duration = '计日'
        payload.custom_days = formDurationDays || '0'
      } else if (isSaturdayOnly) {
        // For 周六托/兴趣班, use 计日 with the days
        payload.enrollment_duration = '计日'
        payload.custom_days = formDurationDays || '0'
      } else {
        payload.enrollment_duration = durationType
      }
      const res = await Network.request<{ data: { end_date: string } }>({
        url: '/api/children/calc-end-date',
        method: 'POST',
        data: payload,
      })
      console.log('[child-detail] calc end date:', res.data)
      setFormEndDate(res.data.data.end_date)
    } catch (err) {
      console.error('[child-detail] calc end date error:', err)
    }
  }

  const submitEnrollment = async () => {
    if (!formCourseType || !formStartDate) {
      Taro.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }
    try {
      const payload: Record<string, any> = {
        child_id: childId,
        course_type: formCourseType,
        duration_type: formDurationType,
        duration_days: formDurationType === '计日' ? parseInt(formDurationDays || '0') : 0,
        start_date: formStartDate,
        end_date: formEndDate,
        status: formStatus,
        payment_amount: formPaymentAmount,
        payment_channel: formPaymentChannel,
      }
      let res
      if (editingEnrollment) {
        res = await Network.request({
          url: `/api/enrollments/${editingEnrollment.id}`,
          method: 'PATCH',
          data: payload,
        })
      } else {
        res = await Network.request({
          url: '/api/enrollments',
          method: 'POST',
          data: payload,
        })
      }
      console.log('[child-detail] enrollment save:', res.data)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      closeEnrollmentForm()
      // Reload enrollments
      const enrollRes = await Network.request<{ data: Enrollment[] }>({
        url: `/api/enrollments/child/${childId}`,
      })
      setEnrollments(enrollRes.data.data || [])
    } catch (err) {
      console.error('[child-detail] enrollment save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
    }
  }

  const deleteEnrollment = async (enr: Enrollment) => {
    Taro.showModal({
      title: '确认删除',
      content: `删除 "${enr.course_type}" 报读记录？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/enrollments/${enr.id}`,
              method: 'DELETE',
            })
            Taro.showToast({ title: '已删除', icon: 'success' })
            const enrollRes = await Network.request<{ data: Enrollment[] }>({
              url: `/api/enrollments/child/${childId}`,
            })
            setEnrollments(enrollRes.data.data || [])
          } catch (err) {
            console.error('[child-detail] delete error:', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full bg-background">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!child) {
    return (
      <View className="flex items-center justify-center h-full bg-background">
        <Text className="block text-gray-500">未找到幼儿信息</Text>
      </View>
    )
  }

  return (
    <ScrollView className="h-full bg-background" scrollY>
      <View className="p-4 space-y-4 pb-8">
        {/* ===== Basic Info Card ===== */}
        <Card>
          <CardContent className="p-4">
            <View className="flex items-start justify-between mb-3">
              <View className="flex items-center gap-2">
                <Text className="block text-2xl font-bold">{child.name}</Text>
                <View className="px-2 py-1 rounded-full bg-gray-100">
                  <Text className="block text-xs text-gray-500">{genderMap[child.gender] || child.gender}</Text>
                </View>
                {child.status && statusMap[child.status] && (
                  <View className={`px-2 py-1 rounded-full ${statusMap[child.status].className}`}>
                    <Text className="block text-xs">{statusMap[child.status].label}</Text>
                  </View>
                )}
              </View>
              <View
                className="p-2 rounded-full hover:bg-gray-100"
                onClick={() => startEdit('basic')}
              >
                <Pencil size={16} color="#999" />
              </View>
            </View>

            {editCard === 'basic' ? (
              <View className="space-y-3">
                <View>
                  <Text className="block text-sm text-muted-foreground mb-1">在读状态</Text>
                  <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.keys(statusMap).map((s) => (
                      <View
                        key={s}
                        className={`px-3 py-2 rounded-full border ${editValues.status === s ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setEditValues({ ...editValues, status: s })}
                      >
                        <Text className="block text-sm">{statusMap[s].label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
                  <Button size="sm" onClick={saveEdit}>保存</Button>
                </View>
              </View>
            ) : (
              <View className="space-y-2">
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">出生日期</Text>
                  <Text className="block text-sm text-foreground">{child.birth_date}（{formatAge(child.birth_date)}）</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">教室</Text>
                  <Text className="block text-sm text-foreground">{child.class_info?.room || '未设置'}</Text>
                </View>
              </View>
            )}
          </CardContent>
        </Card>

        {/* ===== Contact Card ===== */}
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <Text className="block text-base font-semibold">联系信息</Text>
              <View
                className="p-2 rounded-full hover:bg-gray-100"
                onClick={() => startEdit('contact')}
              >
                <Pencil size={16} color="#999" />
              </View>
            </View>

            {editCard === 'contact' ? (
              <View className="space-y-3">
                <View>
                  <Text className="block text-sm text-muted-foreground mb-1">家长姓名</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={editValues.parent_name || ''}
                      placeholder="家长姓名"
                      onInput={(e) => setEditValues({ ...editValues, parent_name: e.detail.value })}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-muted-foreground mb-1">联系电话</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={editValues.parent_phone || ''}
                      placeholder="联系电话"
                      onInput={(e) => setEditValues({ ...editValues, parent_phone: e.detail.value })}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-muted-foreground mb-1">过敏情况</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={editValues.allergies || ''}
                      placeholder="过敏情况"
                      onInput={(e) => setEditValues({ ...editValues, allergies: e.detail.value })}
                    />
                  </View>
                </View>
                <View>
                  <Text className="block text-sm text-muted-foreground mb-1">健康信息</Text>
                  <View className="bg-gray-50 rounded-xl px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      value={editValues.health_info || ''}
                      placeholder="健康信息"
                      onInput={(e) => setEditValues({ ...editValues, health_info: e.detail.value })}
                    />
                  </View>
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
                  <Button size="sm" onClick={saveEdit}>保存</Button>
                </View>
              </View>
            ) : (
              <View className="space-y-2">
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">家长姓名</Text>
                  <Text className="block text-sm text-foreground">{child.parent_name || '未填写'}</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">联系电话</Text>
                  <Text className="block text-sm text-foreground">{child.parent_phone || '未填写'}</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">过敏情况</Text>
                  <Text className="block text-sm text-foreground">{child.allergies || '无'}</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="block text-sm text-muted-foreground">健康信息</Text>
                  <Text className="block text-sm text-foreground">{child.health_info || '无'}</Text>
                </View>
              </View>
            )}
          </CardContent>
        </Card>

        {/* ===== Enrollment Records Card ===== */}
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <Text className="block text-base font-semibold">报读记录</Text>
              <Button size="sm" variant="outline" onClick={openAddEnrollment}>
                <Plus size={14} color="#999" className="mr-1" /> 新增报读
              </Button>
            </View>

            {/* Inline Enrollment Form */}
            {showEnrollmentForm && (
              <View className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <View className="flex items-center justify-between mb-2">
                  <Text className="block text-sm font-medium text-amber-800">
                    {editingEnrollment ? '编辑报读' : '新增报读'}
                  </Text>
                  <View onClick={closeEnrollmentForm}>
                    <X size={16} color="#92400e" />
                  </View>
                </View>

                <View className="space-y-2">
                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">课程类型</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '6px' }}>
                      {COURSE_TYPES.map((t) => (
                        <View
                          key={t}
                          className={`px-3 py-1 rounded-full text-xs ${formCourseType === t ? 'bg-amber-200 text-amber-900' : 'bg-white text-amber-700 border border-amber-200'}`}
                          onClick={() => {
                            setFormCourseType(t)
                            if (['周六托', '兴趣班'].includes(t)) {
                              setFormDurationType('计日')
                            }
                          }}
                        >
                          <Text className="block text-xs">{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">报读时长</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '6px' }}>
                      {DURATION_OPTIONS.map((d) => (
                        <View
                          key={d}
                          className={`px-3 py-1 rounded-full text-xs ${formDurationType === d ? 'bg-amber-200 text-amber-900' : 'bg-white text-amber-700 border border-amber-200'}`}
                          onClick={() => setFormDurationType(d)}
                        >
                          <Text className="block text-xs">{d}</Text>
                        </View>
                      ))}
                    </View>
                    {formDurationType === '计日' && (
                      <View className="mt-2 bg-white rounded-xl px-3 py-2">
                        <Input
                          className="w-full bg-transparent text-sm"
                          type="number"
                          value={formDurationDays}
                          placeholder="输入天数"
                          onInput={(e) => {
                            setFormDurationDays(e.detail.value)
                            setFormEndDate('')
                          }}
                          onBlur={() => handleCalcEndDate()}
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">开始日期</Text>
                    <View className="bg-white rounded-xl px-3 py-2">
                      <Picker
                        mode="date"
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.detail.value)
                          setFormEndDate('')
                        }}
                        onCancel={() => {}}
                      >
                        <Text className="block text-sm text-foreground">{formStartDate || '选择日期'}</Text>
                      </Picker>
                    </View>
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">结束日期（自动计算）</Text>
                    <View className="bg-white rounded-xl px-3 py-2">
                      <Text className="block text-sm text-foreground">{formEndDate || '请先选择课程类型和开始日期'}</Text>
                    </View>
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">状态</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
                      {['进行中', '已结束'].map((s) => (
                        <View
                          key={s}
                          className={`px-3 py-1 rounded-full text-xs ${formStatus === s ? 'bg-amber-200 text-amber-900' : 'bg-white text-amber-700 border border-amber-200'}`}
                          onClick={() => setFormStatus(s)}
                        >
                          <Text className="block text-xs">{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">缴费记录</Text>
                    <View className="bg-white rounded-xl px-3 py-2">
                      <Input
                        className="w-full bg-transparent text-sm"
                        type="number"
                        value={formPaymentAmount}
                        placeholder="输入金额（元）"
                        onInput={(e) => setFormPaymentAmount(e.detail.value)}
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="block text-xs text-amber-700 mb-1">缴费渠道</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
                      {PAYMENT_CHANNELS.map((c) => (
                        <View
                          key={c}
                          className={`px-3 py-1 rounded-full text-xs ${formPaymentChannel === c ? 'bg-amber-200 text-amber-900' : 'bg-white text-amber-700 border border-amber-200'}`}
                          onClick={() => setFormPaymentChannel(c)}
                        >
                          <Text className="block text-xs">{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <Button variant="outline" size="sm" onClick={closeEnrollmentForm}>取消</Button>
                    <Button size="sm" onClick={submitEnrollment}>
                      {editingEnrollment ? '更新' : '新增'}
                    </Button>
                  </View>
                </View>
              </View>
            )}

            {/* Enrollment List */}
            {enrollments.length === 0 ? (
              <View className="py-8 flex items-center justify-center">
                <Text className="block text-sm text-gray-400">暂无报读记录</Text>
              </View>
            ) : (
              <View className="space-y-2">
                {enrollments.map((enr) => (
                  <View
                    key={enr.id}
                    className="p-3 rounded-xl border border-gray-100"
                  >
                    <View className="flex items-start justify-between">
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="block text-sm font-medium">{enr.course_type}</Text>
                          <View className={`px-2 py-1 rounded-full ${enr.status === '进行中' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Text className={`block text-xs ${enr.status === '进行中' ? 'text-green-700' : 'text-gray-500'}`}>
                              {enr.status}
                            </Text>
                          </View>
                        </View>
                        <Text className="block text-xs text-gray-500">
                          {enr.duration_type}{enr.duration_type === '计日' ? `（${enr.duration_days}天）` : ''}
                          {' · '}
                          {enr.start_date} ~ {enr.end_date}
                        </Text>
                        {enr.payment_amount && (
                          <Text className="block text-xs text-gray-500 mt-1">
                            缴费：{enr.payment_amount}元{enr.payment_channel ? `（${enr.payment_channel}）` : ''}
                          </Text>
                        )}
                      </View>
                      <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                        <View
                          className="p-2 rounded-full hover:bg-gray-100"
                          onClick={() => openEditEnrollment(enr)}
                        >
                          <Pencil size={14} color="#999" />
                        </View>
                        <View
                          className="p-2 rounded-full hover:bg-red-50"
                          onClick={() => deleteEnrollment(enr)}
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  )
}