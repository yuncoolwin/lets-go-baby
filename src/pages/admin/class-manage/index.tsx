import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { classApi } from '@/utils/api'
import { Search, Plus, Users, MapPin, GraduationCap } from 'lucide-react-taro'

interface ClassItem {
  id: string
  name: string
  level: string | null
  capacity: number | null
  room: string | null
  age_range: string | null
  status: string
  student_count?: number
  teacher_names?: string
}

const levelTabs = [
  { value: '', label: '全部' },
  { value: 'nursery', label: '托育' },
  { value: 'small', label: '小班' },
  { value: 'medium', label: '中班' },
  { value: 'large', label: '大班' },
]

const levelColorMap: Record<string, string> = {
  nursery: 'bg-orange-100 text-orange-700',
  small: 'bg-blue-100 text-blue-700',
  medium: 'bg-green-100 text-green-700',
  large: 'bg-purple-100 text-purple-700',
}

const levelLabelMap: Record<string, string> = {
  nursery: '托育',
  small: '小班',
  medium: '中班',
  large: '大班',
}

export default function ClassManagePage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeLevel, setActiveLevel] = useState('')
  const [page, setPage] = useState(1)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, pageSize: 20 }
      if (keyword.trim()) params.keyword = keyword.trim()
      if (activeLevel) params.level = activeLevel

      const res = await classApi.list(params)
      console.log('[ClassManage] list:', res)
      if (res.code === 200 && res.data) {
        setClasses(res.data.list || [])
      }
    } catch (err) {
      console.error('[ClassManage] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
    setLoading(false)
  }, [page, keyword, activeLevel])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  const handleSearch = () => {
    setPage(1)
    loadClasses()
  }

  const handleLevelChange = (level: string) => {
    setActiveLevel(level)
    setPage(1)
  }

  const handleCreate = () => {
    Taro.navigateTo({ url: '/pages/admin/class-edit/index' })
  }

  const handleEdit = (id: string) => {
    Taro.navigateTo({ url: `/pages/admin/class-edit/index?id=${id}` })
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 搜索栏 */}
      <View className="bg-white px-4 py-3 sticky top-0 z-10">
        <View className="flex gap-2">
          <View className="flex-1 bg-gray-50 rounded-xl px-4 py-2 flex items-center gap-2">
            <Search size={18} color="#999999" />
            <Input
              className="flex-1 bg-transparent"
              placeholder="搜索班级名称"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={handleSearch}
            />
          </View>
          <Button
            className="bg-primary text-white rounded-xl px-4"
            onClick={handleSearch}
          >
            <Text className="text-sm text-white">搜索</Text>
          </Button>
        </View>

        {/* 级别筛选 */}
        <View className="flex gap-2 mt-3 overflow-x-auto">
          {levelTabs.map((tab) => (
            <View
              key={tab.value}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                activeLevel === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => handleLevelChange(tab.value)}
            >
              <Text className={`text-sm ${activeLevel === tab.value ? 'text-white' : ''}`}>
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 班级列表 */}
      <View className="p-4">
        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </View>
        ) : classes.length === 0 ? (
          <View className="flex flex-col items-center py-16">
            <GraduationCap size={48} color="#999999" />
            <Text className="block text-sm text-muted-foreground mt-3">暂无班级</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className="bg-white rounded-xl border-0 shadow-sm"
                onClick={() => handleEdit(cls.id)}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground">{cls.name}</Text>
                    {cls.level && (
                      <Badge className={`${levelColorMap[cls.level] || 'bg-gray-100 text-gray-700'} text-xs`}>
                        <Text className="text-xs">{levelLabelMap[cls.level] || cls.level}</Text>
                      </Badge>
                    )}
                  </View>

                  <View className="flex flex-wrap gap-3 mt-2">
                    {cls.room && (
                      <View className="flex items-center gap-1">
                        <MapPin size={14} color="#999999" />
                        <Text className="text-xs text-muted-foreground">{cls.room}</Text>
                      </View>
                    )}
                    <View className="flex items-center gap-1">
                      <Users size={14} color="#999999" />
                      <Text className="text-xs text-muted-foreground">
                        {cls.student_count || 0}/{cls.capacity || 30}人
                      </Text>
                    </View>
                  </View>

                  {cls.teacher_names && (
                    <View className="mt-2 pt-2 border-t border-gray-100">
                      <Text className="text-xs text-muted-foreground">
                        教师: {cls.teacher_names}
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 悬浮新建按钮 */}
      <View
        className="fixed bottom-6 right-4 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg"
        style={{ position: 'fixed' }}
        onClick={handleCreate}
      >
        <Plus size={28} color="#ffffff" />
      </View>
    </View>
  )
}
