import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { teacherApi } from '@/utils/api'
import { Search, Users, GraduationCap } from 'lucide-react-taro'

interface Teacher {
  id: string
  real_name: string
  nickname?: string
  phone?: string | null
  title?: string
  class_name?: string
  status: string
  entry_date?: string
  created_at: string
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'active', label: '在职' },
  { value: 'inactive', label: '离职' },
]

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在职', className: 'bg-green-100 text-green-700' },
  inactive: { label: '离职', className: 'bg-gray-100 text-gray-700' },
}

export default function TeacherManagePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadTeachers = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await teacherApi.list({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page: 1,
        pageSize: 50,
      })
      console.log('[TeacherManage] list:', res)
      if (res.code === 200 && res.data) {
        setTeachers(res.data.list || [])
      }
    } catch (err) {
      console.error('[TeacherManage] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    if (showSkeleton) setLoading(false)
  }, [keyword, statusFilter])

  const isFirstRender = useRef(true)

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  useDidShow(() => {
    if (!isFirstRender.current) {
      loadTeachers(false)
    }
    isFirstRender.current = false
  })

  const handleSearch = (value: string) => {
    setKeyword(value)
  }

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-10 w-full mb-3 rounded-lg" />
        <Skeleton className="h-10 w-full mb-4 rounded-lg" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      {/* 搜索栏 */}
      <View className="mb-3">
        <View className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm">
          <Search size={18} color="#999999" />
          <Input
            className="flex-1 bg-transparent text-sm"
            placeholder="搜索教师姓名"
            value={keyword}
            onInput={(e) => handleSearch(e.detail.value)}
          />
        </View>
      </View>

      {/* 状态筛选 */}
      <View className="flex gap-2 mb-4 overflow-x-auto">
        {statusOptions.map((opt) => (
          <View
            key={opt.value}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              statusFilter === opt.value
                ? 'bg-primary text-white'
                : 'bg-white text-foreground'
            }`}
            onClick={() => handleStatusChange(opt.value)}
          >
            <Text className="text-sm">{opt.label}</Text>
          </View>
        ))}
      </View>

      {/* 教师列表 */}
      {teachers.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <GraduationCap size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无教师</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {teachers.map((teacher) => (
            <Card
              key={teacher.id}
              className="bg-white rounded-xl border-0 shadow-sm cursor-pointer"
              onClick={() => Taro.navigateTo({ url: `/pages/admin/teacher-edit/index?id=${teacher.id}` })}
            >
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center">
                      <Users size={20} color="#E8651A" />
                    </View>
                    <View>
                      <Text className="block text-base font-semibold text-foreground">
                        {teacher.nickname || teacher.real_name}
                      </Text>
                      {teacher.nickname && (
                        <Text className="block text-xs text-muted-foreground">{teacher.real_name}</Text>
                      )}
                    </View>
                  </View>
                  <Badge className={`${statusMap[teacher.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[teacher.status]?.label || teacher.status}</Text>
                  </Badge>
                </View>
                <View className="flex flex-wrap gap-x-4 gap-y-1">
                  {teacher.class_name && (
                    <Text className="block text-sm text-muted-foreground">班级: {teacher.class_name}</Text>
                  )}
                  {teacher.title && (
                    <Text className="block text-sm text-muted-foreground">职称: {teacher.title}</Text>
                  )}
                  {teacher.entry_date && (
                    <Text className="block text-sm text-muted-foreground">入职: {teacher.entry_date}</Text>
                  )}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
