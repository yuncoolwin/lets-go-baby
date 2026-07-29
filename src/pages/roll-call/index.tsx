import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'

interface Student {
  id: string
  name: string
  gender: string
  status: string
}

export default function RollCallPage() {
  const router = useRouter()
  const { currentRole } = useAppStore()
  const classId = router.params.id || ''
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadStudents()
  }, [classId])

  const loadStudents = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/teacher/class-students',
        method: 'GET',
        data: { class_id: classId },
      })
      console.log('[RollCall] students:', res.data)
      if (res.data?.data) {
        setStudents(res.data.data)
      }
    } catch (err) {
      console.error('[RollCall] error:', err)
    }
    setLoading(false)
  }

  const toggleStatus = (index: number) => {
    const newStudents = [...students]
    const current = newStudents[index].status
    if (current === 'present') {
      newStudents[index].status = 'absent'
    } else if (current === 'absent') {
      newStudents[index].status = 'leave'
    } else {
      newStudents[index].status = 'present'
    }
    setStudents(newStudents)
  }

  const submitAttendance = async () => {
    setSubmitting(true)
    try {
      const attendanceData = students.map((s) => ({
        child_id: s.id,
        class_id: classId,
        status: s.status,
      }))
      const res = await Network.request({
        url: '/api/teacher/attendance',
        method: 'POST',
        data: { records: attendanceData, teacher_role_id: currentRole?.id },
      })
      console.log('[RollCall] submit:', res.data)
      Taro.showToast({ title: '点名完成', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err) {
      console.error('[RollCall] submit error:', err)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    }
    setSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return { label: '到', className: 'bg-green-100 text-green-700 border-green-200' }
      case 'absent': return { label: '缺', className: 'bg-red-100 text-red-700 border-red-200' }
      case 'leave': return { label: '假', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
      default: return { label: '未', className: 'bg-gray-100 text-gray-700 border-gray-200' }
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-14 w-full mb-3 rounded-xl" />
        <Skeleton className="h-14 w-full mb-3 rounded-xl" />
      </View>
    )
  }

  const presentCount = students.filter((s) => s.status === 'present').length

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      <View className="flex items-center justify-between mb-4">
        <Text className="block text-lg font-bold text-foreground">点名</Text>
        <Text className="text-sm text-primary">
          已到 {presentCount}/{students.length}
        </Text>
      </View>

      <View className="space-y-2">
        {students.map((student, index) => {
          const badge = getStatusBadge(student.status)
          return (
            <Card
              key={student.id}
              className="bg-white rounded-xl border-0 shadow-sm"
              onClick={() => toggleStatus(index)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <View className="flex items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Text className="text-xs font-medium text-primary">{student.name[0]}</Text>
                  </View>
                  <Text className="text-sm font-medium text-foreground">{student.name}</Text>
                </View>
                <Badge className={`${badge.className} text-xs border`}>
                  <Text className="text-xs">{badge.label}</Text>
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </View>

      {/* 底部提交按钮 */}
      <View style={{
        position: 'fixed', bottom: 50, left: 0, right: 0,
        display: 'flex', padding: '12px 16px', backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100,
      }}
      >
        <Button
          className="flex-1 bg-primary text-primary-foreground rounded-xl"
          disabled={submitting}
          onClick={submitAttendance}
        >
          <Text className="text-primary-foreground">{submitting ? '提交中...' : '提交点名'}</Text>
        </Button>
      </View>
    </View>
  )
}
