import { useState, useEffect } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, BookOpen, Plus, X, ChevronDown, Info } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import rabbitLogo from '@/assets/rabbit-logo.png'

interface ClassItem {
  id: string
  name: string
}

interface CourseItem {
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
  course_type?: string
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
  const [mealInfoOpen, setMealInfoOpen] = useState(false)
  const [napInfoOpen, setNapInfoOpen] = useState(false)
  const [moodInfoOpen, setMoodInfoOpen] = useState(false)
  const [recordedStudentIds, setRecordedStudentIds] = useState<string[]>([])
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const ATTENDED_STATUSES = ['present', 'full_day', 'half_day']

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

  const loadStudentsByClass = async (classId: string, courseId?: string) => {
    if (!classId) {
      setStudents([])
      setRecordedStudentIds([])
      return
    }

    try {
      const params: any = { class_id: classId }
      if (courseId) params.course_id = courseId
      const res = await Network.request({
        url: '/api/teachers/class-students',
        method: 'GET',
        data: params
      })
      console.log('[Records] students:', res.data)
      if (res.data?.data) {
        const sorted = [...res.data.data].sort((a: any, b: any) => {
          const aAttended = ATTENDED_STATUSES.includes(a.attendance_status || '')
          const bAttended = ATTENDED_STATUSES.includes(b.attendance_status || '')
          if (aAttended && !bAttended) return -1
          if (!aAttended && bAttended) return 1
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

  // 加载课程列表
  const loadCourses = async () => {
    try {
      const today = new Date()
      const weekday = today.getDay() // 0=周日, 1=周一, ..., 6=周六
      const res = await Network.request({
        url: '/api/teachers/courses',
        method: 'GET',
        data: { weekday }
      })
      console.log('[Records] courses:', res.data)
      if (res.data?.data) {
        setCourses(res.data.data)
      }
    } catch (err) {
      console.error('[Records] load courses error:', err)
    }
  }

  // 选择班级
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
    setSelectedCourseId('')
    setSelectedChildId('')
    setStudents([])
    setRecordedStudentIds([])
    if (classId) {
      loadStudentsByClass(classId)
    }
  }

  // 选择课程
  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId)
    setSelectedChildId('')
    setStudents([])
    setRecordedStudentIds([])
    if (courseId && selectedClassId) {
      loadStudentsByClass(selectedClassId, courseId)
    } else if (selectedClassId) {
      loadStudentsByClass(selectedClassId)
    }
  }

  const loadStudents = async () => {
    try {
      // 使用当前角色ID加载教师管理的班级
      const teacherRoleId = currentRole?.id || ''

      if (teacherRoleId) {
        const classesRes = await Network.request({
          url: '/api/teachers/classes',
          method: 'GET',
          data: { teacher_role_id: teacherRoleId }
        })
        console.log('[Records] teacher classes:', classesRes.data)
        const classList = classesRes.data?.data || []
        setClasses(classList)

        // 加载课程列表
        await loadCourses()

        // 如果当前已选班级仍在列表中则保留，否则默认选中第一个班级
        const targetClassId = selectedClassId && classList.some(c => c.id === selectedClassId)
          ? selectedClassId
          : classList.length > 0 ? classList[0].id : ''
        setSelectedClassId(targetClassId)
        if (targetClassId) {
          // 保留当前已选的课程筛选
          await loadStudentsByClass(targetClassId, selectedCourseId || undefined)
        } else {
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

  const getStatusLabel = (status: string | null | undefined) => {
    const n = parseInt(status || '0', 10)
    return n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—'
  }

  const getStatusBadge = (status: string | null | undefined) => {
    const n = parseInt(status || '0', 10)
    if (n >= 4) return 'bg-green-100 text-green-700'
    if (n >= 2) return 'bg-yellow-100 text-yellow-700'
    if (n >= 1) return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-500'
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
                  {item.course_type ? (
                    <Text className="block text-xs text-gray-400 mb-2">{item.course_type}</Text>
                  ) : null}
                  <View className="flex flex-wrap gap-2 mb-3">
                    {item.meal_status && parseInt(item.meal_status, 10) > 0 && (
                      <Badge className={`rounded-full text-xs ${getStatusBadge(item.meal_status)}`}>
                        餐食: {getStatusLabel(item.meal_status)}
                      </Badge>
                    )}
                    {item.sleep_status && parseInt(item.sleep_status, 10) > 0 && (
                      <Badge className={`rounded-full text-xs ${getStatusBadge(item.sleep_status)}`}>
                        午睡: {getStatusLabel(item.sleep_status)}
                      </Badge>
                    )}
                    {item.mood_status && parseInt(item.mood_status, 10) > 0 && (
                      <Badge className={`rounded-full text-xs ${getStatusBadge(item.mood_status)}`}>
                        情绪: {getStatusLabel(item.mood_status)}
                      </Badge>
                    )}
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
                      handleClassChange(classes[idx].id)
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

              {/* 选择课程 */}
              <Text className="block text-sm font-medium mb-2">选择课程</Text>
              <View className={`relative bg-gray-50 rounded-xl px-4 py-3 mb-4 ${!selectedClassId ? 'opacity-50' : ''}`}>
                <Picker
                  mode="selector"
                  range={courses}
                  rangeKey="name"
                  value={courses.findIndex(c => c.id === selectedCourseId)}
                  onChange={(e) => {
                    const idx = parseInt(String(e.detail.value))
                    if (idx >= 0 && idx < courses.length) {
                      handleCourseChange(courses[idx].id)
                    }
                  }}
                >
                  <View className="flex items-center" style={{ cursor: 'pointer' }}>
                    <Text className="block flex-1" style={{ fontSize: 16, color: selectedCourseId ? '#333' : '#999' }}>
                      {selectedCourseId ? courses.find(c => c.id === selectedCourseId)?.name || '请选择课程' : '请选择课程'}
                    </Text>
                    <ChevronDown size={16} color="#999" />
                  </View>
                </Picker>
              </View>

              {/* 选择幼儿 */}
              <Text className="block text-sm font-medium mb-2">选择幼儿</Text>
              <View className={`relative bg-gray-50 rounded-xl px-4 py-3 mb-4 ${!selectedCourseId ? 'opacity-50' : ''}`}>
                <View
                  className="flex items-center"
                  onClick={() => { if (selectedCourseId) setShowStudentPicker(!showStudentPicker) }}
                  style={{ cursor: selectedCourseId ? 'pointer' : 'default' }}
                >
                  <Text className="block flex-1" style={{ fontSize: 16, color: selectedChildId ? '#333' : '#999' }}>
                    {selectedChildId
                      ? (() => {
                          const stu = students.find(item => item.id === selectedChildId)
                          return stu ? `${stu.child_name}${ATTENDED_STATUSES.includes(stu.attendance_status || '') ? '' : '（不可选）'}` : '请选择幼儿'
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
                        const isPresent = ATTENDED_STATUSES.includes(stu.attendance_status || '')
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

              {[
                { label: '餐食', value: mealStatus, setter: setMealStatus },
                { label: '午睡', value: sleepStatus, setter: setSleepStatus },
                { label: '情绪', value: moodStatus, setter: setMoodStatus },
              ].map(({ label, value, setter }) => (
                <View className="mb-4" key={label}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text className="text-sm font-medium">{label}</Text>
                      {label === '餐食' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setMealInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                      {label === '午睡' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setNapInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                      {label === '情绪' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setMoodInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                    </View>
                    <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = (parseInt(value || '0', 10) || 0) >= star
                      return (
                        <View
                          key={star}
                          style={{
                            width: 48, height: 48, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'transparent',
                          }}
                          onClick={() => setter(parseInt(value || '0', 10) === star && star === 1 ? '' : String(star))}
                        >
                          <Text style={{ fontSize: 28, color: filled ? '#E8651A' : '#d1d5db' }}>
                            {filled ? '★' : '☆'}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ))}

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

          {/* 餐食评分说明弹窗 */}
          {showAddModal && mealInfoOpen && (
            <View
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onClick={() => setMealInfoOpen(false)}
            >
              <View
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text className="block text-lg font-bold text-foreground">餐食评分说明</Text>
                  <View onClick={() => setMealInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#6b7280" />
                  </View>
                </View>
                {[
                  { star: '★★★★★', desc: '自主光盘，主动添饭，不挑食' },
                  { star: '★★★★☆', desc: '少量剩菜，无需喂食' },
                  { star: '★★★☆☆', desc: '一半饭菜，需要简单提醒' },
                  { star: '★★☆☆☆', desc: '进食很少，全程老师喂饭' },
                  { star: '★☆☆☆☆', desc: '拒食、哭闹，进食不足 1/3' },
                ].map((item) => (
                  <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                    <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {/* 午睡评分说明弹窗 */}
          {showAddModal && napInfoOpen && (
            <View
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onClick={() => setNapInfoOpen(false)}
            >
              <View
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text className="block text-lg font-bold text-foreground">午睡评分说明</Text>
                  <View onClick={() => setNapInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#6b7280" />
                  </View>
                </View>
                {[
                  { star: '★★★★★', desc: '自主快速入睡，睡眠质量高，按时起床' },
                  { star: '★★★★☆', desc: '自主入睡较快，睡眠安稳' },
                  { star: '★★★☆☆', desc: '需要简单安抚，入睡较慢' },
                  { star: '★★☆☆☆', desc: '入睡困难，需老师长时间陪伴' },
                  { star: '★☆☆☆☆', desc: '哭闹不睡，全程需老师安抚' },
                ].map((item) => (
                  <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                    <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {/* 情绪评分说明弹窗 */}
          {showAddModal && moodInfoOpen && (
            <View
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onClick={() => setMoodInfoOpen(false)}
            >
              <View
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text className="block text-lg font-bold text-foreground">情绪评分说明</Text>
                  <View onClick={() => setMoodInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#6b7280" />
                  </View>
                </View>
                {[
                  { star: '★★★★★', desc: '全天心情愉悦，自主参与活动、社交' },
                  { star: '★★★★☆', desc: '状态平稳，轻微分心走神，简单引导即可' },
                  { star: '★★★☆☆', desc: '情绪小幅起伏，陪伴安抚1-2分钟就能平复' },
                  { star: '★★☆☆☆', desc: '低落烦躁易怒，抗拒活动、争抢玩具，需长时间安抚' },
                  { star: '★☆☆☆☆', desc: '情绪崩溃失控，抗拒吃饭，安抚半小时仍无法平复' },
                ].map((item) => (
                  <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                    <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                  </View>
                ))}
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
                  {item.meal_status && parseInt(item.meal_status, 10) > 0 && (
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.meal_status)}`}>
                      餐食: {getStatusLabel(item.meal_status)}
                    </Badge>
                  )}
                  {item.sleep_status && parseInt(item.sleep_status, 10) > 0 && (
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.sleep_status)}`}>
                      午睡: {getStatusLabel(item.sleep_status)}
                    </Badge>
                  )}
                  {item.mood_status && parseInt(item.mood_status, 10) > 0 && (
                    <Badge className={`rounded-full text-xs ${getStatusBadge(item.mood_status)}`}>
                      情绪: {getStatusLabel(item.mood_status)}
                    </Badge>
                  )}
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
