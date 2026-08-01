import { useState, useEffect } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { BookOpen, Plus, X } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'

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
        ? '/api/teacher/feedbacks'
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

  const loadStudents = async () => {
    try {
      const classId = currentRole?.class_id || 'demo-class-1'
      const res = await Network.request({
        url: '/api/teachers/class-students',
        method: 'GET',
        data: { class_id: classId }
      })
      console.log('[Records] students:', res.data)
      if (res.data?.data) {
        setStudents(res.data.data)
      }
    } catch (err) {
      console.error('[Records] load students error:', err)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!selectedChildId) return
    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/teacher/feedback',
        method: 'POST',
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
        setActivities('')
        setNotes('')
        loadFeedbacks()
      }
    } catch (err) {
      console.error('[Records] submit error:', err)
    }
    setSubmitting(false)
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
            onClick={() => setShowAddModal(true)}
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
                padding: '20px', maxHeight: '80vh', overflowY: 'auto'
              }}
            >
              <View className="flex items-center justify-between mb-4">
                <Text className="block text-lg font-bold">新增日常记录</Text>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  <X size={20} color="#999" />
                </Button>
              </View>

              {/* 选择幼儿 */}
              <Text className="block text-sm font-medium mb-2">选择幼儿</Text>
              <View className="relative bg-gray-50 rounded-xl px-4 py-3 mb-4">
                <View style={{ display: 'flex', alignItems: 'center' }}>
                  <Text className="block text-sm flex-1 text-gray-500">
                    {selectedChildId ? students.find(s => s.id === selectedChildId)?.child_name || '请选择' : '请选择幼儿'}
                  </Text>
                  <View 
                    style={{ 
                      width: 0, height: 0, 
                      borderLeft: '6px solid transparent', 
                      borderRight: '6px solid transparent', 
                      borderTop: '6px solid #999'
                    }} 
                  />
                </View>
                <Picker
                  mode="selector"
                  range={students}
                  rangeKey="child_name"
                  value={students.findIndex(s => s.id === selectedChildId)}
                  onChange={(e: any) => {
                    const idx = e.detail.value
                    setSelectedChildId(students[idx]?.id || '')
                  }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 1 }}
                />
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
                    onClick={() => setMealStatus(val)}
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
                    onClick={() => setSleepStatus(val)}
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
                    onClick={() => setMoodStatus(val)}
                  >
                    <Text>{label}</Text>
                  </Button>
                ))}
              </View>

              {/* 提交 */}
              <Button
                className="w-full bg-primary text-primary-foreground rounded-xl h-11 mt-4"
                disabled={!selectedChildId || submitting}
                onClick={handleSubmitFeedback}
              >
                <Text className="text-base font-medium text-primary-foreground">
                  {submitting ? '提交中...' : '提交记录'}
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
