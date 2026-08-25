import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { childrenApi } from '@/utils/api'
import { Search } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'
import { getNameInitial } from '@/utils/helpers'

interface Enrollment {
  id: string
  course_type: string
  duration_type: string | null
  start_date: string | null
  end_date: string | null
  extended_end_date: string | null
  status: string
  class_name: string | null
  payment_amount: number | null
  payment_channel: string | null
}

interface Child {
  id: string
  name: string
  nickname?: string
  gender: string
  birth_date: string
  class_id: string | null
  class_name: string | null
  parent_name: string | null
  allergies: string | null
  status: string
  teacher_names: string[]
  created_at: string
  enrollments: Enrollment[]
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'active', label: '在读' },
  { value: 'graduated', label: '毕业' },
  { value: 'suspended', label: '休学' },
]

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在读', className: 'bg-green-100 text-green-700' },
  graduated: { label: '毕业', className: 'bg-blue-100 text-blue-700' },
  suspended: { label: '休学', className: 'bg-yellow-100 text-yellow-700' },
}

const courseTypeColors: Record<string, string> = {
  '全日托': 'bg-orange-50 text-orange-700 border-orange-200',
  '半日托': 'bg-sky-50 text-sky-700 border-sky-200',
  '周六托': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '晚间托': 'bg-purple-50 text-purple-700 border-purple-200',
  '兴趣班': 'bg-pink-50 text-pink-700 border-pink-200',
  '计日': 'bg-teal-50 text-teal-700 border-teal-200',
}

export default function ChildrenManagePage() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadChildren = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await childrenApi.list({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page: 1,
        page_size: 50,
      })
      console.log('[ChildrenManage] list:', res)
      if (res.code === 200 && res.data) {
        setChildren(res.data.list || [])
      }
    } catch (err) {
      console.error('[ChildrenManage] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    if (showSkeleton) setLoading(false)
  }, [keyword, statusFilter])

  useEffect(() => {
    loadChildren()
  }, [loadChildren])

  // 页面显示时重新加载
  useDidShow(() => {
    loadChildren(false)
  })

  const handleSearch = (value: string) => {
    setKeyword(value)
  }

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
  }

  const calculateAge = formatAge

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
    <View className="min-h-screen bg-background p-4 pb-28">
      {/* 搜索栏 */}
      <View className="mb-3">
        <View className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm">
          <Search size={18} color="#999999" />
          <Input
            className="flex-1 bg-transparent text-sm"
            placeholder="搜索幼儿姓名"
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

      {/* 幼儿列表 */}
      {children.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Image src={rabbitLogo} className="w-16 h-16 rounded-full" mode="aspectFit" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无幼儿</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {children.map((child) => (
            <Card
              key={child.id}
              className="bg-white rounded-xl border-0 shadow-sm"
              onClick={() => Taro.navigateTo({ url: `/pages/admin/child-detail/index?id=${child.id}` })}
            >
              <CardContent className="p-4">
                {/* 姓名行 */}
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-2">
                    <View className={`w-6 h-6 rounded-full flex items-center justify-center ${child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                      <Text className={`text-xs font-medium ${child.gender === 'male' ? 'text-blue-700' : 'text-pink-700'}`}>
                        {getNameInitial(child.name)}
                      </Text>
                    </View>
                    <Text className="text-base font-semibold text-foreground">{child.name}</Text>
                    {child.nickname && <Text className="text-xs text-muted-foreground">（{child.nickname}）</Text>}
                    <Text className="text-sm text-muted-foreground">
                      {child.gender === 'male' ? '男' : '女'}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {calculateAge(child.birth_date)}
                    </Text>
                    <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                      <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                    </Badge>
                  </View>
                </View>

                {/* 过敏信息 */}
                {child.allergies && (
                  <View className="mb-2">
                    <Text className="text-sm text-amber-600">过敏：{child.allergies}</Text>
                  </View>
                )}

                {/* 课程标签行 */}
                {child.enrollments && child.enrollments.length > 0 ? (
                  <View className="space-y-1">
                    {child.enrollments.map((enr) => (
                      <View
                        key={enr.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${courseTypeColors[enr.course_type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
                      >
                        <Text className="text-xs font-medium">{enr.course_type}</Text>
                        {enr.class_name && (
                          <Text className="text-xs opacity-80">| {enr.class_name}</Text>
                        )}
                        {enr.start_date && (
                          <Text className="text-xs opacity-70">
                            {enr.start_date}{(enr.extended_end_date || enr.end_date) ? ` ~ ${enr.extended_end_date || enr.end_date}` : '起'}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="flex items-center gap-1">
                    <Text className="text-xs text-muted-foreground">暂无报读课程</Text>
                  </View>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      )}
      {/* 底部固定按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #f0f0f0',
          padding: '12px 16px', zIndex: 100
        }}
      >
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={() => Taro.navigateTo({ url: '/pages/admin/child-add/index' })}
        >
          <Text className="text-white">新增幼儿</Text>
        </Button>
      </View>
    </View>
  )
}