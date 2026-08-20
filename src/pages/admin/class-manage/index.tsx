import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MapPin, Pencil, ChevronDown, ChevronUp } from 'lucide-react-taro'
import { classApi, courseApi } from '@/utils/api'

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

function calcAge(birthDate?: string | null): string {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  return years > 0 ? `${years}岁${months}个月` : `${months}个月`
}

export default function ClassManagePage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCourseType, setActiveCourseType] = useState('all')
  const [courses, setCourses] = useState<any[]>([])
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
      const [classRes, courseRes] = await Promise.all([
        classApi.list(),
        courseApi.list(),
      ])
      console.log('[ClassManage] list:', classRes)
      if (courseRes.code === 200) {
        const courseList = Array.isArray(courseRes.data) ? courseRes.data : courseRes.data?.list || []
        setCourses(courseList)
      }
      if (classRes.code === 200) {
        const list: ClassItem[] = (classRes.data.list || classRes.data || []) as ClassItem[]
        const filtered = activeCourseType && activeCourseType !== 'all'
          ? list.filter(c => {
              const ec = (c as any).enrollment_counts || {}
              return Object.keys(ec).includes(activeCourseType)
            })
          : list
        setClasses(filtered.map(c => ({
          ...c,
          teacherNames: (c as any).teacher_names ?? [],
        })))
      }
    } catch (err) {
      console.error('[ClassManage] load error:', err)
    }
    if (showSkeleton) setLoading(false)
  }, [activeCourseType])

  const loadExpandedData = useCallback(async (classId: string, courseType?: string) => {
    setChildrenLoading(true)
    try {
      // 并行获取教师列表和报读记录（按课程类型筛选）
      const params = courseType && courseType !== 'all' ? { course_type: courseType } : undefined
      const [classDetailRes, enrollmentsRes] = await Promise.all([
        classApi.detail(classId),
        classApi.enrollments(classId, params),
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
  }, [activeCourseType])

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
      await loadExpandedData(id, activeCourseType !== 'all' ? activeCourseType : undefined)
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

      {/* 课程类型筛选标签 */}
      <ScrollView scrollX className="bg-white border-b border-gray-100">
        <View className="flex px-3 py-2 gap-2" style={{ display: 'flex', flexDirection: 'row' }}>
          <View
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeCourseType === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => {
              setActiveCourseType('all')
              setExpandedId(null)
              setExpandedTeachers([])
              setExpandedGroups([])
              setTotalStudents(0)
            }}
          >
            <Text className={`text-sm ${activeCourseType === 'all' ? 'text-white' : ''}`}>
              全部
            </Text>
          </View>
          {courses.map((course) => (
            <View
              key={course.id}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                activeCourseType === course.name
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => {
                setActiveCourseType(course.name)
                setExpandedId(null)
                setExpandedTeachers([])
                setExpandedGroups([])
                setTotalStudents(0)
              }}
            >
              <Text className={`text-sm ${activeCourseType === course.name ? 'text-white' : ''}`}>
                {course.name}
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
              {activeCourseType && activeCourseType !== 'all' ? `暂无${activeCourseType}班级` : '暂无班级'}
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
                              <Text className="block text-sm text-gray-500">{cls.room}</Text>
                            </View>
                          )}
                          
                        </View>

                        {/* 各课程类型独立计数 */}
                        <View className="flex flex-wrap gap-x-3 gap-y-1">
                          {(Object.entries((cls as any).enrollment_counts || {}) as [string, number][])
                            .filter(([courseType]) => activeCourseType === 'all' || courseType === activeCourseType)
                            .map(([courseType, count]) => (
                            <View key={courseType} className="flex items-center gap-1">
                              <Badge className={`text-sm ${courseColorMap[courseType] || 'bg-gray-100 text-gray-600'}`}>
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
                                <Skeleton className="h-5 w-20 mb-1" />
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
                                  {expandedTeachers.length > 0 && (
                                    <Text className="block text-xs text-gray-400 ml-auto">
                                      {expandedTeachers.map(t => t.real_name || '未命名').join('、')}
                                    </Text>
                                  )}
                                </View>
                                {/* 幼儿列表 */}
                                <View className="space-y-2">
                                  {group.students.map((child) => (
                                    <View key={child.enrollment_id} className="flex flex-row items-center py-1">
                                      <View className="flex flex-row items-baseline gap-2 flex-1">
                                        <Text className="text-sm font-medium text-black">{child.name}</Text>
                                        <Text className="text-xs text-gray-400">{child.gender === 'male' ? '男' : '女'}</Text>
                                        <Text className="text-xs text-gray-400">{calcAge(child.birth_date)}</Text>
                                      </View>
                                      <Text className="text-xs text-gray-400 text-right">{child.start_date ? `${child.start_date}${child.end_date ? ` ~ ${child.end_date}` : '起'}` : ''}</Text>
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
