import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { childrenApi } from '@/utils/api'
import { Search, UserCheck, Plus } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'

interface Child {
  id: string
  name: string
  gender: string
  birth_date: string
  class_id: string | null
  parent_name: string | null
  allergies: string | null
  status: string
  created_at: string
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

  // 页面显示时重新加载（处理审核后返回的情况）
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
    <View className="min-h-screen bg-background p-4 pb-20">
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
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-2">
                    <Text className="text-base font-semibold text-foreground">{child.name}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {child.gender === 'male' ? '男' : '女'}
                    </Text>
                  </View>
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
                </View>
                <View className="space-y-1">
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-muted-foreground">年龄: {calculateAge(child.birth_date)}</Text>
                    {child.class_id && (
                      <Text className="text-sm text-muted-foreground">班级: {child.class_id}</Text>
                    )}
                  </View>
                  <View className="flex items-center gap-1">
                    <Text className="text-xs text-muted-foreground">过敏: {child.allergies || '无'}</Text>
                  </View>
                  {child.parent_name && (
                    <View className="flex items-center gap-1">
                      <UserCheck size={14} color="#999999" />
                      <Text className="text-xs text-muted-foreground">家长: {child.parent_name}</Text>
                    </View>
                  )}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
      {/* 悬浮新增按钮 */}
      <View
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg z-50"
        onClick={() => Taro.navigateTo({ url: '/pages/admin/child-add/index' })}
      >
        <Plus size={24} color="#fff" />
      </View>
    </View>
  )
}
