import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Users, MapPin, Pencil, ChevronDown, ChevronUp } from 'lucide-react-taro'
import { classApi, childrenApi } from '@/utils/api'
import { formatAge } from '@/utils/format'

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

const levelColorMap: Record<string, string> = {
  nursery: 'bg-blue-50 text-blue-700',
  summer: 'bg-orange-50 text-orange-700',
  winter: 'bg-sky-50 text-sky-700',
  interest: 'bg-purple-50 text-purple-700',
}

const statusLabelMap: Record<string, string> = {
  active: '正常',
  inactive: '停用',
}

interface ClassItem {
  id: string
  name: string
  level: string
  capacity: number
  room?: string
  status: string
  teacherCount?: number
  studentCount?: number
  teacherNames?: string[]
  created_at?: string
}

interface ChildItem {
  id: string
  name: string
  gender: string
  birth_date?: string
  status: string
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
  const [expandedChildren, setExpandedChildren] = useState<ChildItem[]>([])
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
          studentCount: (c as any).student_count ?? 0,
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
      // 并行获取教师和幼儿列表
      const [classDetailRes, childrenRes] = await Promise.all([
        classApi.detail(classId),
        childrenApi.list({ class_id: classId }),
      ])

      if (classDetailRes.code === 200) {
        setExpandedTeachers(classDetailRes.data?.teachers || [])
      }

      if (childrenRes.code === 200) {
        const list: ChildItem[] = (childrenRes.data.list || childrenRes.data || []) as ChildItem[]
        setExpandedChildren(list.filter(c => c.status === 'active'))
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
      setExpandedChildren([])
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
                setExpandedChildren([])
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
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="block text-base font-semibold text-foreground">
                            {cls.name}
                          </Text>
                          {expandedId === cls.id
                            ? <ChevronUp size={16} color="#9ca3af" />
                            : <ChevronDown size={16} color="#9ca3af" />
                          }
                        </View>

                        {/* 级别 + 状态标签 */}
                        <View className="flex flex-wrap gap-2 mb-2">
                          {cls.level && (
                            <Badge className={`text-xs ${levelColorMap[cls.level] || 'bg-gray-100 text-gray-600'}`}>
                              {levelLabelMap[cls.level] || cls.level}
                            </Badge>
                          )}
                          <Badge className={`text-xs ${cls.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {statusLabelMap[cls.status] || cls.status}
                          </Badge>
                        </View>

                        {/* 详细信息 */}
                        <View className="flex flex-wrap gap-x-4 gap-y-1">
                          <View className="flex items-center gap-1">
                            <Users size={13} color="#9ca3af" />
                            <Text className="block text-xs text-gray-500">
                              {cls.studentCount ?? 0}/{cls.capacity}人
                            </Text>
                          </View>
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

                    {/* 幼儿列表 */}
                    <View>
                      <Text className="block text-xs text-muted-foreground ml-1 mb-1">
                        在读幼儿 ({expandedChildren.length})
                      </Text>
                      {childrenLoading ? (
                        <View className="space-y-2">
                          {[1, 2].map(i => (
                            <Card key={i} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                <Skeleton className="h-5 w-24 mb-1" />
                                <Skeleton className="h-4 w-16" />
                              </CardContent>
                            </Card>
                          ))}
                        </View>
                      ) : expandedChildren.length === 0 ? (
                        <Text className="block text-xs text-muted-foreground ml-1">暂无在读幼儿</Text>
                      ) : (
                        <View className="space-y-2">
                          {expandedChildren.map(child => (
                            <Card key={child.id} className="bg-white rounded-xl border-0 shadow-sm">
                              <CardContent className="p-3">
                                <View className="flex items-center justify-between mb-1">
                                  <View className="flex items-center gap-2">
                                    <Text className="text-sm font-semibold text-foreground">{child.name}</Text>
                                    <Text className="text-xs text-muted-foreground">
                                      {child.gender === 'male' ? '男' : '女'}
                                    </Text>
                                  </View>
                                </View>
                                {child.birth_date && (
                                  <Text className="block text-xs text-muted-foreground">年龄: {formatAge(child.birth_date)}</Text>
                                )}
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
