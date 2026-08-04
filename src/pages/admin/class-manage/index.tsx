import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MapPin, Pencil, ChevronDown, ChevronUp } from 'lucide-react-taro'
import { classApi } from '@/utils/api'

const levelTabs = [
  { value: '', label: '全部' },
  { value: 'nursery', label: '托班' },
  { value: 'summer', label: '暑假班' },
  { value: 'winter', label: '寒假班' },
  { value: 'interest', label: '兴趣班' },
]

const levelLabelMap: Record<string, string> = {
  nursery: '托班',
  summer: '暑假班',
  winter: '寒假班',
  interest: '兴趣班',
}

const courseColorMap: Record<string, string> = {
  '全日托': 'bg-green-50 text-green-700',
  '半日托': 'bg-blue-50 text-blue-700',
  '周六托': 'bg-purple-50 text-purple-700',
  '晚间托': 'bg-indigo-50 text-indigo-700',
  '兴趣班': 'bg-orange-50 text-orange-700',
}

interface ClassItem {
  id: string
  name: string
  level: string
  capacity: number
  room?: string
  status: string
  teacherCount?: number
  teacherNames?: string[]
  enrollment_counts?: Record<string, number>
  created_at?: string
}

interface EnrollmentGroup {
  course_type: string
  students: {
    enrollment_id: string
    child_id: string
    name: string
    gender: string
    birth_date?: string
    start_date: string | null
    end_date: string | null
  }[]
}

interface TeacherItem {
  id: string
  real_name: string | null
}

export default function ClassManagePage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLevel, setActiveLevel] = useState('')
  const isFirstMount = useRef(true)

  // 展开卡片状态
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTeachers, setExpandedTeachers] = useState<TeacherItem[]>([])
  const [expandedGroups, setExpandedGroups] = useState<EnrollmentGroup[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [childrenLoading, setChildrenLoading] = useState(false)

  const loadClasses = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await classApi.list(activeLevel ? { level: activeLevel } : undefined)
      console.log('[ClassManage] list:', res)
      if (res.code === 200) {
        const list: ClassItem[] = (res.data.list || res.data || []) as ClassItem[]
        setClasses(list.map(c => ({
          ...c,
          teacherNames: (c as any).teacher_names ?? [],
        })))
      }
    } catch (err) {
      console.error('[ClassManage] load error:', err)
    }
    if (showSkeleton) setLoading(false)
  }, [activeLevel])

  const loadExpandedData = useCallback(async (classId: string) => {
    setChildrenLoading(true)
    try {
      // 并行获取教师列表和报读记录
      const [classDetailRes, enrollmentsRes] = await Promise.all([
        classApi.detail(classId),
        classApi.enrollments(classId),
      ])

      if (classDetailRes.code === 200) {
        setExpandedTeachers(classDetailRes.data?.teachers || [])
      }

      if (enrollmentsRes.code === 200) {
        const data = enrollmentsRes.data
        setExpandedGroups(data?.groups || [])
        setTotalStudents(data?.total_students || 0)
      }
    } catch (err) {
      console.error('[ClassManage] load expanded data error:', err)
    }
    setChildrenLoading(false)
  }, [])

  useEffect(() => {
    loadClasses(true)
    isFirstMount.current = false
  }, [loadClasses])

  useDidShow(() => {
    if (!isFirstMount.current) {
      loadClasses(false)
    }
  })

  const goCreate = () => {
    Taro.navigateTo({ url: '/pages/admin/class-edit/index' })
  }

  const goEdit = (id: string) => {
    Taro.navigateTo({ url: `/pages/admin/class-edit/index?id=${id}` })
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedTeachers([])
      setExpandedGroups([])
      setTotalStudents(0)
    } else {
      setExpandedId(id)
      await loadExpandedData(id)
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部标题栏 */}
      <View className="bg-white px-4 py-4 border-b border-gray-100">
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text className="block text-lg font-semibold">班级管理</Text>
          <Button className="bg-primary text-white rounded-xl px-4 py-2 flex items-center gap-1" onClick={goCreate}>
            <Plus size={16} color="#fff" />
            <Text className="text-white text-sm">添加班级</Text>
          </Button>
        </View>
      </View>

      {/* 级别筛选标签 */}
      <ScrollView scrollX className="bg-white border-b border-gray-100">
        <View className="flex px-3 py-2 gap-2" style={{ display: 'flex', flexDirection: 'row' }}>
          {levelTabs.map((tab) => (
            <View
              key={tab.value}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                activeLevel === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => {
                setActiveLevel(tab.value)
                setExpandedId(null)
                setExpandedTeachers([])
                setExpandedGroups([])
                setTotalStudents(0)
              }}
            >
              <Text className={`text-sm ${activeLevel === tab.value ? 'text-white' : ''}`}>
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 内容区 */}
      <View className="p-4">
        {loading ? (
          // 骨架屏
          <View className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </View>
        ) : classes.length === 0 ? (
          // 空状态
          <View className="flex flex-col items-center justify-center py-24">
            <Text className="block text-gray-400 text-base mb-4">
              {activeLevel ? `暂无${levelLabelMap[activeLevel] || ''}班级` : '暂无班级'}
            </Text>
            <Button className="bg-primary text-white rounded-xl px-6 py-2" onClick={goCreate}>
              <Text className="text-white text-sm">添加第一个班级</Text>
            </Button>
          </View>
        ) : (
          // 班级卡片列表
          <View className="space-y-3">
            {classes.map((cls) => (
              <View key={cls.id}>
                <Card className="bg-white rounded-xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    {/* 卡片头部：点击区域（展开）+ 右侧编辑按钮 */}
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View className="flex-1" onClick={() => toggleExpand(cls.id)}>
                        {/* 班级名称 + 展开图标 */}
                        <View className="flex items-center gap-2 mb-2">
                          <Text className="block text-base font-semibold text-foreground">
                            {cls.name}
                          </Text>
                          {expandedId === cls.id
                            ? <ChevronUp size={16} color="#9ca3af" />
                            : <ChevronDown size={16} color="#9ca3af" />
                          }
                        </View>

                        {/* 教室 + 老师 */}
                        <View className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                          {cls.room && (
                            <View className="flex items-center gap-1">
                              <MapPin size={13} color="#9ca3af" />
                              <Text className="block text-xs text-gray-500">{cls.room}</Text>
                            </View>
                          )}
                          {cls.teacherNames && cls.teacherNames.length > 0 ? (
                            <Text className="block text-xs text-gray-500">
                              老师: {cls.teacherNames.join('、')}
                            </Text>
                          ) : cls.teacherCount !== undefined && cls.teacherCount > 0 ? (
                            <Text className="block text-xs text-gray-500">
                              {cls.teacherCount}位教师
                            </Text>
                          ) : null}
                        </View>

                        {/* 各课程类型独立计数 */}
                        <View className="flex flex-wrap gap-x-3 gap-y-1">
                          {(Object.entries((cls as any).enrollment_counts || {}) as [string, number][]).map(([courseType, count]) => (
                            <View key={courseType} className="flex items-center gap-1">
                              <Badge className={`text-xs ${courseColorMap[courseType] || 'bg-gray-100 text-gray-600'}`}>
                                {courseType}
                              </Badge>
                              <Text className="block text-xs text-gray-500">{count}/{cls.capacity}人</Text>
                            </View>
                          ))}
                          {(!cls.enrollment_counts || Object.keys(cls.enrollment_counts).length === 0) && (
                            <Text className="block text-xs text-gray-400">暂无在读幼儿</Text>
                          )}
                        </View>
                      </View>

                      {/* 右侧编辑按钮 */}
                      <View
                        className="p-2 ml-2"
                        onClick={(e) => {
                          e.stopPropagation?.()
                          goEdit(cls.id)
                        }}
                      >
                        <Pencil size={18} color="#9ca3af" />
                      </View>
                    </View>
                  </CardContent>
                </Card>

                {/* 展开的教师 + 幼儿列表 */}
                {expandedId === cls.id && (
                  <View className="mt-2 space-y-3">
                    {/* 教师列表 */}
                    <View>
                      <Text className="block text-xs text-muted-foreground ml-1 mb-1">
                        带班老师 ({expandedTeachers.length > 0 ? expandedTeachers.length : (cls.teacherNames?.length || 0)})
                      </Text>
                      {childrenLoading ? (
                        <View className="space-y-2">
                          <Skeleton className="h-8 w-full rounded-lg" />
                        </View>
                      ) : expandedTeachers.length > 0 ? (
                        <View className="space-y-2">
                          {expandedTeachers.map(teacher => (
                            <Card key={teacher.id} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                <View className="flex items-center gap-2">
                                  <View className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Text className="text-xs font-medium text-amber-700">
                                      {(teacher.real_name || '师').charAt(0)}
                                    </Text>
                                  </View>
                                  <Text className="text-sm font-semibold text-foreground">
                                    {teacher.real_name || '未命名教师'}
                                  </Text>
                                </View>
                              </CardContent>
                            </Card>
                          ))}
                        </View>
                      ) : cls.teacherNames && cls.teacherNames.length > 0 ? (
                        <View className="space-y-2">
                          {cls.teacherNames.map((name, idx) => (
                            <Card key={idx} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                <View className="flex items-center gap-2">
                                  <View className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Text className="text-xs font-medium text-amber-700">{name.charAt(0)}</Text>
                                  </View>
                                  <Text className="text-sm font-semibold text-foreground">{name}</Text>
                                </View>
                              </CardContent>
                            </Card>
                          ))}
                        </View>
                      ) : (
                        <Text className="block text-xs text-muted-foreground ml-1">暂无带班老师</Text>
                      )}
                    </View>

                    {/* 幼儿列表（按课程类型分组） */}
                    <View>
                      <Text className="block text-xs text-muted-foreground ml-1 mb-1">
                        在读幼儿 ({totalStudents})
                      </Text>
                      {childrenLoading ? (
                        <View className="space-y-2">
                          {[1, 2].map(i => (
                            <Card key={i} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                <View className="flex items-center gap-2 mb-1">
                                  <Skeleton className="h-6 w-6 rounded-full" />
                                  <Skeleton className="h-5 w-20" />
                                </View>
                                <Skeleton className="h-4 w-16" />
                              </CardContent>
                            </Card>
                          ))}
                        </View>
                      ) : expandedGroups.length === 0 ? (
                        <Text className="block text-xs text-muted-foreground ml-1">暂无在读幼儿</Text>
                      ) : (
                        <View className="space-y-3">
                          {expandedGroups.map((group) => (
                            <Card key={group.course_type} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                {/* 课程类型标题 */}
                                <View className="flex items-center gap-2 mb-2">
                                  <Badge className={`text-xs ${courseColorMap[group.course_type] || 'bg-gray-100 text-gray-600'}`}>
                                    {group.course_type}
                                  </Badge>
                                  <Text className="block text-xs text-gray-500">{group.students.length}人</Text>
                                </View>
                                {/* 幼儿列表 */}
                                <View className="space-y-2">
                                  {group.students.map((child) => (
                                    <View key={child.enrollment_id} className="flex items-center justify-between py-1">
                                      <View className="flex items-center gap-2">
                                        <View className={`w-6 h-6 rounded-full flex items-center justify-center ${child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                                          <Text className={`text-xs font-medium ${child.gender === 'male' ? 'text-blue-700' : 'text-pink-700'}`}>
                                            {(child.name || '幼').charAt(0)}
                                          </Text>
                                        </View>
                                        <Text className="text-sm font-medium text-foreground">{child.name}</Text>
                                        <Text className="text-xs text-muted-foreground">
                                          {child.gender === 'male' ? '男' : '女'}
                                        </Text>
                                      </View>
                                      <Text className="text-xs text-gray-400">
                                        {child.start_date || ''}{child.end_date ? ` ~ ${child.end_date}` : ''}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </CardContent>
                            </Card>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 底部间距（避开 TabBar） */}
      <View className="h-16" />
    </View>
  )
}
