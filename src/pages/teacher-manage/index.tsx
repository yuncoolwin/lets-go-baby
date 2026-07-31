import { useState, useEffect, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react-taro'
import { teacherApi } from '@/utils/api'

interface Teacher {
  id: string
  nickname?: string
  real_name: string
  title?: string
  class_name?: string
  phone?: string
  status: string
}

export default function TeacherManagePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const isFirst = useRef(true)

  const loadTeachers = async () => {
    try {
      const res = await teacherApi.list()
      const list = res.data?.list || res.data || []
      const active = (Array.isArray(list) ? list : []).filter(
        (t: Teacher) => t.status === 'active'
      )
      setTeachers(active)
    } catch (err) {
      console.error('[TeacherManage] load error:', err)
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeachers()
  }, [])

  useDidShow(() => {
    if (!isFirst.current) {
      loadTeachers()
    }
    isFirst.current = false
  })

  return (
    <View className="min-h-screen bg-background">
      {/* 头部 */}
      <View className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <Text className="block text-lg font-bold text-foreground">教师管理</Text>
        <Text className="block text-sm text-gray-500 mt-1">
          共 {teachers.length} 位在职教师
        </Text>
      </View>

      {/* 内容区 */}
      <View className="p-4">
        {/* 教师列表 */}
        <Text className="block text-sm font-semibold text-foreground mb-3">
          教师列表 ({teachers.length})
        </Text>
        <View className="space-y-3">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center gap-3">
                  <View className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Users size={20} color="#3b82f6" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="block text-base font-semibold text-foreground">
                      {teacher.nickname || teacher.real_name || '未知'}
                    </Text>
                    <Text className="block text-xs text-gray-400 mt-1">
                      {teacher.real_name || '未填写姓名'}
                    </Text>
                    <Text className="block text-xs text-gray-400 mt-1">
                      {teacher.class_name || '未分配班级'}
                      {teacher.title ? ` · ${teacher.title}` : ''}
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      Taro.navigateTo({
                        url: `/pages/teacher-detail/index?id=${teacher.id}`
                      })
                    }}
                  >
                    <Text className="text-xs">查看</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}

          {/* 骨架屏 */}
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-white rounded-xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <View className="flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <View className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2 rounded" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </View>
                      <Skeleton className="w-16 h-8 rounded-lg" />
                    </View>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* 空状态 */}
          {!loading && teachers.length === 0 && (
            <Card className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-8 flex flex-col items-center justify-center">
                <Users size={40} color="#d1d5db" className="mb-3" />
                <Text className="block text-sm text-gray-400 text-center">
                  暂无在职教师
                </Text>
              </CardContent>
            </Card>
          )}
        </View>
      </View>
    </View>
  )
}
