import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'
import { Users } from 'lucide-react-taro'

interface Student {
  id: string
  name: string
  avatar_url: string | null
  status: 'present' | 'absent' | 'leave' | null
}

interface ClassInfo {
  id: string
  name: string
  student_count: number
}

export default function RollCallPage() {
  const { currentRole } = useAppStore()
  const [classList, setClassList] = useState<ClassInfo[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadClasses = useCallback(async () => {
    try {
      const res = await Network.request({
        url: `/api/teacher/class-overview?teacher_role_id=${currentRole?.id || ''}`,
        method: 'GET',
      })
      console.log('[RollCall] classes:', res.data)
      if (res.data?.data) {
        setClassList(res.data.data)
        if (res.data.data.length > 0) {
          setSelectedClass(res.data.data[0].id)
        }
      }
    } catch (err) {
      console.error('[RollCall] load classes error:', err)
    }
  }, [currentRole?.id])

  const loadStudents = useCallback(async (classId: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/teacher/class/${classId}/students`,
        method: 'GET',
      })
      console.log('[RollCall] students:', res.data)
      if (res.data?.data) {
        const studentList = res.data.data.map((s: { id: string; name: string; avatar_url: string | null }) => ({
          ...s,
          status: null,
        }))
        setStudents(studentList)
      }
    } catch (err) {
      console.error('[RollCall] load students error:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass)
    }
  }, [selectedClass, loadStudents])

  const setStatus = (studentId: string, status: 'present' | 'absent' | 'leave') => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    )
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700'
      case 'absent': return 'bg-red-100 text-red-700'
      case 'leave': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'present': return '已到'
      case 'absent': return '缺席'
      case 'leave': return '请假'
      default: return '未点'
    }
  }

  const handleSave = async () => {
    const unmarked = students.filter((s) => s.status === null)
    if (unmarked.length > 0) {
      Taro.showToast({ title: `还有${unmarked.length}名学生未点名`, icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const records = students.map((s) => ({
        child_id: s.id,
        status: s.status,
      }))
      const res = await Network.request({
        url: '/api/teacher/attendance',
        method: 'POST',
        data: {
          class_id: selectedClass,
          date: new Date().toISOString().split('T')[0],
          records,
        },
      })
      console.log('[RollCall] save:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '点名完成', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[RollCall] save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
    setSaving(false)
  }

  const presentCount = students.filter((s) => s.status === 'present').length
  const absentCount = students.filter((s) => s.status === 'absent').length
  const leaveCount = students.filter((s) => s.status === 'leave').length

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-16 w-full mb-3 rounded-xl" />
        <Skeleton className="h-16 w-full mb-3 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <View className="flex items-center justify-between mb-4">
        <Text className="text-lg font-bold text-foreground">幼儿点名</Text>
        <Text className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* 班级选择 */}
      {classList.length > 1 && (
        <View className="flex gap-2 mb-4 overflow-x-auto">
          {classList.map((cls) => (
            <View
              key={cls.id}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                selectedClass === cls.id
                  ? 'bg-primary text-white'
                  : 'bg-white text-foreground'
              }`}
              onClick={() => setSelectedClass(cls.id)}
            >
              <Text className="text-sm">{cls.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 统计 */}
      <View className="flex gap-3 mb-4">
        <View className="flex-1 bg-green-50 rounded-xl p-3 text-center">
          <Text className="block text-lg font-bold text-green-600">{presentCount}</Text>
          <Text className="block text-xs text-green-600">已到</Text>
        </View>
        <View className="flex-1 bg-red-50 rounded-xl p-3 text-center">
          <Text className="block text-lg font-bold text-red-600">{absentCount}</Text>
          <Text className="block text-xs text-red-600">缺席</Text>
        </View>
        <View className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
          <Text className="block text-lg font-bold text-orange-600">{leaveCount}</Text>
          <Text className="block text-xs text-orange-600">请假</Text>
        </View>
      </View>

      {/* 学生列表 */}
      {students.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Users size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无学生</Text>
        </View>
      ) : (
        <View className="flex flex-col gap-3 mb-4">
          {students.map((student) => (
            <Card key={student.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <Text className="text-sm font-medium text-primary">{student.name.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-foreground">{student.name}</Text>
                    <Badge className={`${getStatusColor(student.status)} text-xs mt-1`}>
                      <Text className="text-xs">{getStatusLabel(student.status)}</Text>
                    </Badge>
                  </View>
                  <View className="flex gap-2">
                    <View
                      className={`px-3 py-2 rounded-lg text-xs font-medium ${
                        student.status === 'present'
                          ? 'bg-green-500 text-white'
                          : 'bg-green-50 text-green-600'
                      }`}
                      onClick={() => setStatus(student.id, 'present')}
                    >
                      到
                    </View>
                    <View
                      className={`px-3 py-2 rounded-lg text-xs font-medium ${
                        student.status === 'absent'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-50 text-red-600'
                      }`}
                      onClick={() => setStatus(student.id, 'absent')}
                    >
                      缺
                    </View>
                    <View
                      className={`px-3 py-2 rounded-lg text-xs font-medium ${
                        student.status === 'leave'
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-50 text-orange-600'
                      }`}
                      onClick={() => setStatus(student.id, 'leave')}
                    >
                      假
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 提交按钮 */}
      {students.length > 0 && (
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          disabled={saving}
          onClick={handleSave}
        >
          <Text className="text-white">{saving ? '保存中...' : '完成点名'}</Text>
        </Button>
      )}
    </View>
  )
}