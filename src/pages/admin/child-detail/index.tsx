import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { childrenApi, enrollmentApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Pencil, Trash2, BookOpen } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge } from '@/utils/format'

interface ChildDetail {
  id: string
  name: string
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

const levelMap: Record<string, string> = {
  nursery: '托育',
  small: '小班',
  medium: '中班',
  large: '大班',
}

const calculateAge = formatAge

export default function ChildDetailPage() {
  const router = useRouter()
  const { id } = router.params
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [enrollments, setEnrollments] = useState<any[]>([])

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

  const handleDelete = () => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除幼儿"${child?.name}"的档案吗？此操作不可恢复。`,
      confirmColor: '#E8651A',
      success: async (res) => {
        if (res.confirm) {
          setDeleting(true)
          try {
            const result = await childrenApi.remove(id!)
            if (result.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                Taro.navigateBack()
              }, 1500)
            } else {
              Taro.showToast({ title: result.msg || '删除失败', icon: 'none' })
            }
          } catch {
            Taro.showToast({ title: '网络错误', icon: 'none' })
          } finally {
            setDeleting(false)
          }
        }
      },
    })
  }

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
        <Text className="text-muted-foreground">幼儿档案不存在</Text>
        <Button className="mt-4" onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </Button>
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
            <View className="flex items-center gap-4 mb-4">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full" mode="aspectFit" />
              <View className="flex-1">
                <View className="flex items-center gap-2">
                  <Text className="text-xl font-bold text-foreground">{child.name}</Text>
                  {child.course_type && (
                    <Badge className="bg-purple-50 text-purple-700 text-xs">
                      <Text className="text-xs">{child.course_type}</Text>
                    </Badge>
                  )}
                  <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                  </Badge>
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
              {child.course_type && (
                <View className="flex items-center justify-between py-2 border-b border-border">
                  <Text className="text-sm text-muted-foreground">课程类型</Text>
                  <Text className="text-sm text-foreground">{child.course_type}</Text>
                </View>
              )}
              {child.enrollment_duration && (
                <View className="flex items-center justify-between py-2 border-b border-border">
                  <Text className="text-sm text-muted-foreground">报读时长</Text>
                  <Text className="text-sm text-foreground">{child.enrollment_duration}</Text>
                </View>
              )}
              {child.enrollment_duration === '计日' && child.custom_days && (
                <View className="flex items-center justify-between py-2 border-b border-border">
                  <Text className="text-sm text-muted-foreground">计日天数</Text>
                  <Text className="text-sm text-foreground">{child.custom_days}天</Text>
                </View>
              )}
              {child.start_date && (
                <View className="flex items-center justify-between py-2 border-b border-border">
                  <Text className="text-sm text-muted-foreground">开始日期</Text>
                  <Text className="text-sm text-foreground">{child.start_date}</Text>
                </View>
              )}
              {child.end_date && (
                <View className="flex items-center justify-between py-2 border-b border-border">
                  <Text className="text-sm text-muted-foreground">结束日期</Text>
                  <Text className="text-sm text-foreground">{child.end_date}</Text>
                </View>
              )}
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">所在班级</Text>
                <Text className="text-sm text-foreground">
                  {child.class_info ? `${child.class_info.name}（${levelMap[child.class_info.level] || child.class_info.level}）` : '未分班'}
                </Text>
              </View>
              <View className="flex items-center justify-between py-2 border-b border-border">
                <Text className="text-sm text-muted-foreground">教室</Text>
                <Text className="text-sm text-foreground">{child.class_info?.room || '未设置'}</Text>
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
        {enrollments.length > 0 && (
          <Card className="bg-white rounded-xl border-0 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center gap-2 mb-3">
                <BookOpen size={16} color="#666" />
                <Text className="text-base font-semibold text-foreground">报读记录</Text>
              </View>
              {enrollments.map((enr) => (
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
                  <Text className="text-xs text-gray-500">
                    时长：{enr.duration_type === '计日' ? `${enr.duration_days}天` : enr.duration_type}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    日期：{enr.start_date || '--'} ~ {enr.end_date || '--'}
                  </Text>
                  {(enr.payment_amount || enr.payment_channel) && (
                    <Text className="text-xs text-gray-500 mt-1">
                      缴费：{enr.payment_amount ? `${enr.payment_amount}元` : ''}{enr.payment_channel ? `（${enr.payment_channel}）` : ''}
                    </Text>
                  )}
                </View>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <Button
            className="flex-1 bg-primary text-white rounded-xl"
            onClick={() => Taro.navigateTo({ url: `/pages/admin/child-edit/index?id=${child.id}` })}
          >
            <View className="flex items-center justify-center gap-2">
              <Pencil size={16} color="#fff" />
              <Text className="text-white">编辑</Text>
            </View>
          </Button>
          <Button
            className="flex-1 bg-red-500 text-white rounded-xl"
            onClick={handleDelete}
            disabled={deleting}
          >
            <View className="flex items-center justify-center gap-2">
              <Trash2 size={16} color="#fff" />
              <Text className="text-white">{deleting ? '删除中...' : '删除'}</Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  )
}
