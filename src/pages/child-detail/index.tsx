import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { childrenApi, enrollmentApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { BookOpen, Pencil } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'

interface ChildDetail {
  id: string
  name: string
  nickname?: string
  gender: string
  birth_date: string
  class_id: string | null
  parent_name: string | null
  parent_phone: string | null
  health_info: string | null
  allergies: string | null
  status: string
  course_type: string | null
  enrollment_duration: string | null
  custom_days: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  class_info?: {
    id: string
    name: string
    level: string
    room: string
  } | null
}

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在读', className: 'bg-green-100 text-green-700' },
  graduated: { label: '毕业', className: 'bg-blue-100 text-blue-700' },
  suspended: { label: '休学', className: 'bg-orange-100 text-orange-700' },
}

const calculateAge = formatAge

export default function ParentChildDetailPage() {
  const router = useRouter()
  const { id } = router.params
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<any[]>([])

  const handleEdit = () => {
    Taro.navigateTo({ url: `/pages/admin/child-detail/index?id=${id}` })
  }

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [childRes, enrRes] = await Promise.all([
        childrenApi.detail(id),
        enrollmentApi.list(id!),
      ])
      if (childRes.code === 200 && childRes.data) {
        setChild(childRes.data as unknown as ChildDetail)
      } else {
        Taro.showToast({ title: childRes.msg || '加载失败', icon: 'none' })
      }
      if (enrRes.code === 200 && Array.isArray(enrRes.data)) {
        console.log('[ChildDetail] enrollments loaded:', enrRes.data.length, 'first enr extended_end_date:', enrRes.data[0]?.extended_end_date, 'enr keys:', Object.keys(enrRes.data[0] || {}).join(','));
        setEnrollments(enrRes.data as any[])
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    loadData()
  })

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </View>
    )
  }

  if (!child) {
    return (
      <View className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <Text className="block text-muted-foreground">幼儿档案不存在</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">幼儿详情</Text>
      </View>

      <View className="p-4 space-y-4">
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-start gap-4 mb-4">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full flex-shrink-0" mode="aspectFit" />
              <View className="flex-1">
                <View className="flex items-center gap-2">
                  <View className="flex items-baseline">
                    <Text className="text-xl font-bold text-foreground">{child.name}</Text>
                    {child.nickname && <Text className="text-sm text-muted-foreground">（{child.nickname}）</Text>}
                  </View>
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
                  <Pencil size={16} color="#999" onClick={handleEdit} />
                </View>
                <Text className="block text-sm text-muted-foreground mt-1">
                  {child.gender === 'male' ? '男' : '女'} · {calculateAge(child.birth_date)}
                </Text>
              </View>
            </View>

            <View className="space-y-3">
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">出生日期</Text>
                <Text className="text-sm text-foreground">{child.birth_date || '未设置'}</Text>
              </View>
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">在读状态</Text>
                <Text className="text-sm text-foreground">{statusMap[child.status]?.label || child.status}</Text>
              </View>
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">过敏情况</Text>
                <Text className="text-sm text-foreground">{child.allergies || '无'}</Text>
              </View>
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">家长姓名</Text>
                <Text className="text-sm text-foreground">{child.parent_name || '未设置'}</Text>
              </View>
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">家长电话</Text>
                <Text className="text-sm text-foreground">{child.parent_phone || '未设置'}</Text>
              </View>
              <View className="flex items-center justify-between py-2">
                <Text className="text-sm text-muted-foreground">健康信息</Text>
                <Text className="text-sm text-foreground">{child.health_info || '无'}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 报读记录卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-3">
              <BookOpen size={16} color="#666" />
              <Text className="text-base font-semibold text-foreground">报读记录</Text>
            </View>
            {enrollments.length === 0 ? (
              <View className="py-8 flex items-center justify-center">
                <Text className="block text-sm text-muted-foreground">暂无报读记录</Text>
              </View>
            ) : (
              enrollments.map((enr) => (
                <View
                  key={enr.id}
                  className="bg-gray-50 rounded-xl p-3 mb-2"
                >
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-sm font-semibold text-foreground">{enr.course_type}</Text>
                    <Badge className={enr.status === '进行中' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      <Text className="text-xs">{enr.status}</Text>
                    </Badge>
                  </View>
                  <View className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <Text className="block text-xs">
                      {enr.duration_type === '计日' ? `${enr.duration_days || 0}天` : enr.duration_type || ''}
                      {' · '}
                      {enr.start_date} ~ {enr.end_date || '未设置'}
                    </Text>
                  </View>
                  {enr.extended_end_date && (
                    <View className="flex items-center gap-1 mt-1">
                      <Text className="text-xs text-orange-500">
                        顺延至 {enr.extended_end_date}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </CardContent>
        </Card>
        </View>
      </View>
  )
}