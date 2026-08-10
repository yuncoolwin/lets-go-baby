import { useState, useEffect } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 , BookOpen, Plus, X, ChevronDown } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import rabbitLogo from '@/assets/rabbit-logo.png'

interface ClassItem {
  id: string
  name: string
}

interface FeedbackItem {
  id: string
  child_name: string
  feedback_date: string
  meal_status: string | null
  sleep_status: string | null
  mood_status: string | null
  activities: string | null
  notes: string | null
  teacher_name: string
}

interface Student {
  id: string
  child_name: string
  avatar_url: string | null
  attendance_status?: string | null
}

export default function RecordsPage() {
  const { currentRole, children } = useAppStore()
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [mealStatus, setMealStatus] = useState('')
  const [sleepStatus, setSleepStatus] = useState('')
  const [moodStatus, setMoodStatus] = useState('')
  const [activities, setActivities] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showStudentPicker, setShowStudentPicker] = useState(false)
  const [recordedStudentIds, setRecordedStudentIds] = useState<string[]>([])
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')

  useEffect(() => {
    loadFeedbacks()
    if (currentRole?.role_type === 'teacher') {
      loadStudents()
    }
  }, [currentRole])

  const loadFeedbacks = async () => {
    setLoading(true)
    try {
      const url = currentRole?.role_type === 'teacher'
        ? '/api/teachers/feedbacks'
        : '/api/parent/feedbacks'
      const res = await Network.request({ url, method: 'GET' })
      console.log('[Records] feedbacks:', res.data)
      if (res.data?.data) {
        setFeedbacks(res.data.data)
      }
    } catch (err) {
      console.error('[Records] error:', err)
    }
    setLoading(false)
  }

  const loadStudentsByClass = async (classId: string) => {
    if (!classId) {
      setStudents([])
      setRecordedStudentIds([])
      return
    }

    try {
      const res = await Network.request({
        url: '/api/teachers/class-students',
        method: 'GET',
        data: { class_id: classId }
      })
      console.log('[Records] students:', res.data)
      if (res.data?.data) {
        const sorted = [...res.data.data].sort((a: any, b: any) => {
          if (a.attendance_status === 'present' && b.attendance_status !== 'present') return -1
          if (a.attendance_status !== 'present' && b.attendance_status === 'present') return 1
          return 0
        })
        setStudents(sorted)
      }

      const feedbackRes = await Network.request({
        url: '/api/teachers/feedbacks',
        method: 'GET',
        data: { class_id: classId }
      })
      console.log('[Records] existing feedbacks:', feedbackRes.data)
      if (feedbackRes.data?.data) {
        const recordedIds = feedbackRes.data.data.map((f: any) => f.child_id)
        setRecordedStudentIds(recordedIds)
      }
    } catch (err) {
      console.error('[Records] load students error:', err)
    }
  }

  const loadStudents = async () => {
    try {
      // 从存储获取教师ID
      const userInfo = Taro.getStorageSync('userInfo')
      const teacherId = userInfo?.teacher_id || ''

      // 加载教师管理的班级
      if (teacherId) {
        const classesRes = await Network.request({
          url: '/api/teachers/classes',
          method: 'GET',
        })
        console.log('[Records] teacher classes:', classesRes.data)
        const classList = classesRes.data?.data || []
        setClasses(classList)

        // 默认选中第一个班级
        if (classList.length > 0) {
          setSelectedClassId(classList[0].id)
          await loadStudentsByClass(classList[0].id)
        } else {
          setSelectedClassId('')
          setStudents([])
          setRecordedStudentIds([])
        }
      }
    } catch (err) {
      console.error('[Records] load students error:', err)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!selectedChildId) return
    setSubmitting(true)
    try {
      const isUpdate = !!editingFeedbackId
      const res = await Network.request({
        url: isUpdate ? `/api/teachers/feedback/${editingFeedbackId}` : '/api/teachers/feedback',
        method: isUpdate ? 'PUT' : 'POST',
        data: {
          child_id: selectedChildId,
          teacher_role_id: currentRole?.id,
          meal_status: mealStatus,
          sleep_status: sleepStatus,
          mood_status: moodStatus,
          activities: activities || null,
          notes: notes || null,
        }
      })
      console.log('[Records] submit feedback:', res.data)
      if (res.data?.code === 200) {
        setShowAddModal(false)
        setSelectedChildId('')
        setEditingFeedbackId('')
        setMealStatus('')
        setSleepStatus('')
        setMoodStatus('')
        setActivities('')
        setNotes('')
        await loadFeedbacks()
        await loadStudents()
      }
    } catch (err) {
      console.error('[Records] submit error:', err)
    }
    setSubmitting(false)
  }

  const handleEditFeedback = (item: any) => {
    setSelectedChildId(item.child_id || '')
    setMealStatus(item.meal_status || '')
    setSleepStatus(item.sleep_status || '')
    setMoodStatus(item.mood_status || '')
    setNotes(item.notes || '')
    setEditingFeedbackId(item.id || '')
    setShowAddModal(true)
  }

  const handleDeleteFeedback = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/teachers/feedback/${id}`, method: 'DELETE' })
      if (res.data?.code === 200) {
        await loadFeedbacks()
        await loadStudents()
      } else {
        console.error('删除失败', res.data)
      }
    } catch (err) {
      console.error('删除失败', err)
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'good': case 'happy': return '好'
      case 'normal': return '一般'
      case 'poor': case 'upset': return '差'
      case 'none': return '无'
      default: return '—'
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'good': case 'happy': return 'bg-green-100 text-green-700'
      case 'normal': return 'bg-yellow-100 text-yellow-700'
      case 'poor': case 'upset': return 'bg-red-100 text-red-700'
      case 'none': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-400'
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-32 w-full mb-3 rounded-xl" />
        <Skeleton className="h-32 w-full mb-3 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </View>
    )
  }

  // 教师端：可以查看和新增记录
  if (currentRole?.role_type === 'teacher') {
    return (
      <View className="min-h-screen bg-background p-4 pb-20">
        <View className="flex items-center justify-between mb-4">
          <Text className="block text-lg font-bold text-foreground">日常记录</Text>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground rounded-lg"
            onClick={() => {
              setShowAddModal(true);
              // 每次打开弹窗时重新加载幼儿列表，同步最新考勤状态
              if (currentRole?.role_type === 'teacher') {
                loadStudents();
              }
            }}
          >
            <Plus size={14} className="mr-1" color="#fff" />
            <Text className="text-xs text-primary-foreground">新增</Text>
          </Button>
        </View>

        {feedbacks.length === 0 ? (
          <View className="flex flex-col items-center py-16">
            <BookOpen size={48} color="#999999" />
            <Text className="block text-sm text-muted-foreground mt-3">暂无记录</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {feedbacks.map((item) => (
              <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm" onClick={() => handleEditFeedback(item)}>
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-3">
                    <Text className="block text-base font-semibold text-foreground">
                      {item.child_name}
                    </Text>
                    <View className="flex items-center gap-2">
                      <Text className="block text-xs text-muted-foreground">
                        {item.feedback_date}
                      </Text>
                      <View className="w-6 h-6 flex items-center justify-center" onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFeedback(item.id);
                      }}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </View>
                    </View>
                  </View>
                  <View className="flex flex-wrap gap-2 mb-3">
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.meal_status)}`}>
                      餐食: {getStatusLabel(item.meal_status)}
                    </Badge>
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.sleep_status)}`}>
                      午睡: {getStatusLabel(item.sleep_status)}
                    </Badge>
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.mood_status)}`}>
                      情绪: {getStatusLabel(item.mood_status)}
                    </Badge>
                  </View>
                  {item.activities && (
                    <Text className="block text-sm text-foreground mb-1">
                      活动: {item.activities}
                    </Text>
                  )}
                  {item.notes && (
                    <Text className="block text-sm text-muted-foreground">
                      备注: {item.notes}
                    </Text>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {/* 新增记录弹窗 */}
        {showAddModal && (
          <View
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
              display: 'flex', alignItems: 'flex-end'
            }}
          >
            <View
              style={{
                backgroundColor: '#fff', width: '100%', borderRadius: '16px 16px 0 0',
                padding: '20px 20px 100px', maxHeight: '85vh', overflowY: 'auto'
              }}
            >
              <View className="flex items-center justify-between mb-4">
                <Text className="block text-lg font-bold">新增日常记录</Text>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  <X size={20} color="#999" />
                </Button>
              </View>

              {/* 选择班级 */}
              <Text className="block text-sm font-medium mb-2">选择班级</Text>
              <View className="relative bg-gray-50 rounded-xl px-4 py-3 mb-4">
                <Picker
                  mode="selector"
                  range={classes}
                  rangeKey="name"
                  value={classes.findIndex(c => c.id === selectedClassId)}
                  onChange={(e) => {
                    const idx = parseInt(String(e.detail.value))
                    if (idx >= 0 && idx < classes.length) {
                      const cls = classes[idx]
                      setSelectedClassId(cls.id)
                      setSelectedChildId('')
                      loadStudentsByClass(cls.id)
                    }
                  }}
                >
                  <View className="flex items-center" style={{ cursor: 'pointer' }}>
                    <Text className="block flex-1" style={{ fontSize: 16, color: selectedClassId ? '#333' : '#999' }}>
                      {selectedClassId ? classes.find(c => c.id === selectedClassId)?.name || '请选择班级' : '请选择班级'}
                    </Text>
                    <ChevronDown size={16} color="#999" />
                  </View>
                </Picker>
              </View>

              {/* 选择幼儿 */}
              <Text className="block text-sm font-medium mb-2">选择幼儿</Text>
              <View className={`relative bg-gray-50 rounded-xl px-4 py-3 mb-4 ${!selectedClassId ? 'opacity-50' : ''}`}>
                <View
                  className="flex items-center"
                  onClick={() => setShowStudentPicker(!showStudentPicker)}
                  style={{ cursor: 'pointer' }}
                >
                  <Text className="block flex-1" style={{ fontSize: 16, color: selectedChildId ? '#333' : '#999' }}>
                    {selectedChildId
                      ? (() => {
                          const stu = students.find(item => item.id === selectedChildId)
                          return stu ? `${stu.child_name}${stu.attendance_status === 'present' ? '' : '（不可选）'}` : '请选择幼儿'
                        })()
                      : '请选择幼儿'}
                  </Text>
                  <View
                    style={{
                      width: 0, height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #999',
                      marginLeft: 8
                    }}
                  />
                </View>
                {showStudentPicker && (
                  <View className="mt-2 border-t border-gray-200 pt-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {students.length === 0 ? (
                      <Text className="block text-sm text-center text-gray-400 py-3">暂无幼儿</Text>
                    ) : (
                      students.map((stu) => {
                        const isPresent = stu.attendance_status === 'present'
                        const isRecorded = recordedStudentIds.includes(stu.id)
                        const isSelected = stu.id === selectedChildId
                        const canSelect = isPresent && !isRecorded
                        return (
                          <View
                            key={stu.id}
                            className="flex items-center justify-between px-3 py-3"
                            style={{
                              backgroundColor: isSelected ? '#f0f7ff' : 'transparent',
                              opacity: canSelect ? 1 : 0.5,
                              borderRadius: 8,
                              marginBottom: 2,
                              cursor: canSelect ? 'pointer' : 'not-allowed'
                            }}
                            onClick={() => {
                              if (!canSelect) return
                              setSelectedChildId(stu.id)
                              setShowStudentPicker(false)
                            }}
                          >
                            <Text className="block" style={{ fontSize: 16, fontWeight: 500 }}>
                              {stu.child_name}
                            </Text>
                            <View style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                              {isRecorded && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                  <Text className="block text-xs">已记录</Text>
                                </Badge>
                              )}
                              {!isRecorded && (
                                <Badge
                                  variant="outline"
                                  className={isPresent ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}
                                >
                                  <Text className="block text-xs">
                                    {isPresent ? '出勤' : stu.attendance_status === 'absent' ? '缺席' : stu.attendance_status === 'leave' ? '请假' : '未考勤'}
                                  </Text>
                                </Badge>
                              )}
                            </View>
                          </View>
                        )
                      })
                    )}
                  </View>
                )}
              </View>

              {/* 餐食 */}
              <Text className="block text-sm font-medium mb-2">餐食</Text>
              <View className="flex gap-2 mb-4">
                {[['good', '好'], ['normal', '一般'], ['poor', '差'], ['none', '无']].map(([val, label]) => (
                  <Button
                    key={val}
                    variant={mealStatus === val ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 rounded-lg ${mealStatus === val ? 'bg-primary' : ''}`}
                    onClick={() => setMealStatus(mealStatus === val ? '' : val)}
                  >
                    <Text>{label}</Text>
                  </Button>
                ))}
              </View>

              {/* 午睡 */}
              <Text className="block text-sm font-medium mb-2">午睡</Text>
              <View className="flex gap-2 mb-4">
                {[['good', '好'], ['normal', '一般'], ['poor', '差'], ['none', '无']].map(([val, label]) => (
                  <Button
                    key={val}
                    variant={sleepStatus === val ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 rounded-lg ${sleepStatus === val ? 'bg-primary' : ''}`}
                    onClick={() => setSleepStatus(sleepStatus === val ? '' : val)}
                  >
                    <Text>{label}</Text>
                  </Button>
                ))}
              </View>

              {/* 情绪 */}
              <Text className="block text-sm font-medium mb-2">情绪</Text>
              <View className="flex gap-2 mb-4">
                {[['happy', '开心'], ['normal', '一般'], ['upset', '低落'], ['none', '无']].map(([val, label]) => (
                  <Button
                    key={val}
                    variant={moodStatus === val ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 rounded-lg ${moodStatus === val ? 'bg-primary' : ''}`}
                    onClick={() => setMoodStatus(moodStatus === val ? '' : val)}
                  >
                    <Text>{label}</Text>
                  </Button>
                ))}
              </View>

              {/* 提交 */}
              <Button
                className="w-full bg-primary text-white rounded-xl h-11 mt-4"
                disabled={!selectedChildId || submitting}
                onClick={handleSubmitFeedback}
              >
                <Text className="text-base font-medium text-white">
                  {submitting ? '提交中...' : '保存记录'}
                </Text>
              </Button>
              </View>
          </View>
        )}
      </View>
    )
  }

  // 家长端：查看反馈（未绑定幼儿时显示绑定提示）
  if (children.length === 0) {
    return (
      <View className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <Image
          src={rabbitLogo}
          className="w-16 h-16 rounded-full mb-4"
          mode="aspectFit"
        />
        <Text className="block text-base font-medium text-foreground mb-2">请先绑定幼儿</Text>
        <Text className="block text-sm text-muted-foreground mb-6 text-center">
          绑定幼儿后即可查看每日反馈
        </Text>
        <Button
          className="bg-primary text-white rounded-lg px-6"
          onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
        >
          <Text>立即绑定</Text>
        </Button>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      <Text className="block text-lg font-bold text-foreground mb-4">每日反馈</Text>

      {feedbacks.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <BookOpen size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无反馈</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {feedbacks.map((item) => (
            <Card key={item.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-3">
                  <Text className="block text-base font-semibold text-foreground">
                    {item.child_name}
                  </Text>
                  <Text className="block text-xs text-muted-foreground">
                    {item.feedback_date}
                  </Text>
                </View>
                <View className="flex flex-wrap gap-2 mb-3">
                  <Badge className={`rounded-full text-xs ${getStatusBadge(item.meal_status)}`}>
                    餐食: {getStatusLabel(item.meal_status)}
                  </Badge>
                  <Badge className={`rounded-full text-xs ${getStatusBadge(item.sleep_status)}`}>
                    午睡: {getStatusLabel(item.sleep_status)}
                  </Badge>
                  <Badge className={`rounded-full text-xs ${getStatusBadge(item.mood_status)}`}>
                    情绪: {getStatusLabel(item.mood_status)}
                  </Badge>
                </View>
                {item.activities && (
                  <Text className="block text-sm text-foreground mb-1">
                    活动: {item.activities}
                  </Text>
                )}
                {item.notes && (
                  <Text className="block text-sm text-muted-foreground">
                    备注: {item.notes}
                  </Text>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
