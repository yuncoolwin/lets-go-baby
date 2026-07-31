import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Users, MapPin } from 'lucide-react-taro'
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
  created_at?: string
}

export default function ClassManagePage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLevel, setActiveLevel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [, setDeleting] = useState(false)
  const isFirstMount = useRef(true)

  const loadClasses = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await classApi.list(activeLevel ? { level: activeLevel } : undefined)
      console.log('[ClassManage] list:', res)
      if (res.code === 200) {
        setClasses(res.data.list || res.data || [])
      }
    } catch (err) {
      console.error('[ClassManage] load error:', err)
    }
    if (showSkeleton) setLoading(false)
  }, [activeLevel])

  // 首次加载
  useEffect(() => {
    loadClasses(true)
    isFirstMount.current = false
  }, [loadClasses])

  // 返回时自动刷新
  useDidShow(() => {
    if (!isFirstMount.current) {
      loadClasses(false)
    }
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await classApi.remove(deleteTarget)
      console.log('[ClassManage] delete:', res)
      if (res.code === 200) {
        setClasses((prev) => prev.filter((c) => c.id !== deleteTarget))
        Taro.showToast({ title: '删除成功', icon: 'success' })
      } else {
        Taro.showToast({ title: res.msg || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[ClassManage] delete error:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const goCreate = () => {
    Taro.navigateTo({ url: '/pages/admin/class-edit/index' })
  }

  const goEdit = (id: string) => {
    Taro.navigateTo({ url: `/pages/admin/class-edit/index?id=${id}` })
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
              onClick={() => setActiveLevel(tab.value)}
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
              <Card key={cls.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View className="flex-1" onClick={() => goEdit(cls.id)}>
                      {/* 班级名称 */}
                      <Text className="block text-base font-semibold text-foreground mb-1">
                        {cls.name}
                      </Text>

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
                        {cls.teacherCount !== undefined && cls.teacherCount > 0 && (
                          <Text className="block text-xs text-gray-500">
                            {cls.teacherCount}位教师
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* 删除按钮 */}
                    <AlertDialog>
                      <AlertDialogTrigger className="p-2 rounded-lg ml-2">
                        <Trash2 size={16} color="#ef4444" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            <Text className="block text-lg font-semibold">确认删除</Text>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <Text className="block text-sm text-gray-500">
                              确定要删除班级「{cls.name}」吗？此操作不可撤销。
                            </Text>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            <Text className="block text-sm">取消</Text>
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setDeleteTarget(cls.id)
                              handleDelete()
                            }}
                          >
                            <Text className="block text-sm text-white">确认删除</Text>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 底部间距（避开 TabBar） */}
      <View className="h-16" />
    </View>
  )
}
