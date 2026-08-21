import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { Users, ChevronRight } from 'lucide-react-taro'

interface ClassInfo {
  id: string
  name: string
  description: string | null
  student_count: number
  teacher_count: number
}

interface StudentInfo {
  id: string
  name: string
  gender: string
  attendance_status: string
}

export default function ClassDetailPage() {
  const router = useRouter()
  const classId = router.params.id || ''
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (classId) {
      loadClassDetail()
    }
  }, [classId])

  const loadClassDetail = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/classes/detail',
        method: 'GET',
        data: { class_id: classId },
      })
      console.log('[ClassDetail] detail:', res.data)
      if (res.data?.data) {
        setClassInfo(res.data.data.class_info)
        setStudents(res.data.data.students || [])
      }
    } catch (err) {
      console.error('[ClassDetail] error:', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-24 w-full mb-4 rounded-xl" />
        <Skeleton className="h-14 w-full mb-3 rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      {/* 班级信息 */}
      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <Text className="block text-lg font-bold text-foreground mb-2">
            {classInfo?.name || '班级'}
          </Text>
          {classInfo?.description && (
            <Text className="block text-sm text-muted-foreground mb-3">
              {classInfo.description}
            </Text>
          )}
          <View className="flex gap-6">
            <View>
              <Text className="block text-lg font-bold text-primary">{classInfo?.student_count || 0}</Text>
              <Text className="block text-xs text-muted-foreground">幼儿</Text>
            </View>
            <View>
              <Text className="block text-lg font-bold text-primary">{classInfo?.teacher_count || 0}</Text>
              <Text className="block text-xs text-muted-foreground">教师</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 快捷操作 */}
      <Card
        className="bg-white rounded-xl border-0 shadow-sm mb-4"
        onClick={() => Taro.switchTab({ url: '/pages/roll-call/index' })}
      >
        <CardContent className="p-4 flex items-center justify-between">
          <View className="flex items-center gap-3">
            <View className="w-10 h-10 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center">
              <Users size={20} color="#E8651A" />
            </View>
            <Text className="text-sm font-medium text-foreground">开始考勤</Text>
          </View>
          <ChevronRight size={16} color="#999" />
        </CardContent>
      </Card>

      {/* 幼儿列表 */}
      <Text className="block text-base font-semibold text-foreground mb-3">幼儿名单</Text>
      {students.length === 0 ? (
        <View className="flex flex-col items-center py-8">
          <Users size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无幼儿</Text>
        </View>
      ) : (
        <View className="space-y-2">
          {students.map((student) => (
            <Card key={student.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <View className="flex items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Text className="text-xs font-medium text-primary">{student.name[0]}</Text>
                  </View>
                  <View>
                    <Text className="block text-sm text-foreground">{student.name}</Text>
                    <Text className="block text-xs text-muted-foreground">
                      {student.gender === 'male' ? '男' : '女'}
                    </Text>
                  </View>
                </View>
                <View className={`w-2 h-2 rounded-full ${
                  student.attendance_status === 'present' ? 'bg-green-500' : 'bg-gray-300'
                }`}
                />
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
