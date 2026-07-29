import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { Baby, Bus, BookOpen, Users, ClipboardCheck, Camera, ShieldCheck, UserCheck } from 'lucide-react-taro'

interface BabyStatus {
  child_id: string
  child_name: string
  avatar_url: string | null
  attendance_status: string
  check_in_time: string | null
  check_out_time: string | null
  latest_feedback: {
    meal_status: string | null
    sleep_status: string | null
    mood_status: string | null
  } | null
}

interface ClassOverview {
  id: string
  name: string
  student_count: number
  today_attendance: number
}

export default function IndexPage() {
  const { isLoggedIn, currentRole, isLoading, fetchUserInfo } = useAppStore()
  const [babyStatus, setBabyStatus] = useState<BabyStatus | null>(null)
  const [classList, setClassList] = useState<ClassOverview[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      fetchUserInfo()
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn && currentRole) {
      loadPageData()
    }
  }, [isLoggedIn, currentRole])

  const loadPageData = async () => {
    setPageLoading(true)
    try {
      if (currentRole?.role_type === 'parent') {
        await loadParentData()
      } else if (currentRole?.role_type === 'teacher') {
        await loadTeacherData()
      } else if (currentRole?.role_type === 'admin') {
        await loadAdminData()
      }
    } catch (err) {
      console.error('[Index] loadPageData error:', err)
    }
    setPageLoading(false)
  }

  const loadParentData = async () => {
    const res = await Network.request({
      url: '/api/parent/baby-status',
      method: 'GET',
    })
    console.log('[Index] baby status:', res.data)
    if (res.data?.data) {
      setBabyStatus(res.data.data)
    }
  }

  const loadTeacherData = async () => {
    const res = await Network.request({
      url: '/api/teacher/class-overview',
      method: 'GET',
    })
    console.log('[Index] class overview:', res.data)
    if (res.data?.data) {
      setClassList(res.data.data)
    }
  }

  const loadAdminData = async () => {
    const res = await Network.request({
      url: '/api/admin/pending-count',
      method: 'GET',
    })
    console.log('[Index] pending count:', res.data)
    if (res.data?.data) {
      setPendingCount(res.data.data.count || 0)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return '已入园'
      case 'absent': return '未入园'
      case 'leave': return '请假'
      default: return '未知'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700'
      case 'absent': return 'bg-red-100 text-red-700'
      case 'leave': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getEmoji = (status: string | null) => {
    switch (status) {
      case 'good': case 'happy': return '😊'
      case 'normal': return '😐'
      case 'poor': case 'upset': return '😢'
      default: return '—'
    }
  }

  // 未登录状态
  if (!isLoggedIn && !isLoading) {
    return (
      <View className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
        <View className="mb-8 flex flex-col items-center">
          <View className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">力高</Text>
          </View>
          <Text className="block text-xl font-bold text-foreground">力高稚家</Text>
          <Text className="block text-sm text-muted-foreground mt-1">专业托育管理平台</Text>
        </View>
        <Button
          className="w-full bg-primary text-primary-foreground rounded-xl py-3"
          onClick={() => {
            fetchUserInfo()
          }}
        >
          <Text>微信授权登录</Text>
        </Button>
        <Text className="block text-xs text-muted-foreground mt-4">
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    )
  }

  // 加载中
  if (pageLoading || isLoading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-48 mb-4 rounded-lg" />
        <Skeleton className="h-40 w-full mb-4 rounded-xl" />
        <View className="flex gap-3">
          <Skeleton className="h-24 flex-1 rounded-xl" />
          <Skeleton className="h-24 flex-1 rounded-xl" />
        </View>
      </View>
    )
  }

  // 家长端首页
  if (currentRole?.role_type === 'parent') {
    return (
      <View className="min-h-screen bg-background p-4">
        {/* 欢迎区域 */}
        <View className="mb-4">
          <Text className="block text-xl font-bold text-foreground">
            你好，{useAppStore.getState().nickname || '家长'}
          </Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 宝宝状态卡片 */}
        {babyStatus && (
          <Card className="mb-4 bg-white rounded-xl border-0 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center gap-3 mb-3">
                <View className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Baby size={24} color="#E8651A" />
                </View>
                <View className="flex-1">
                  <Text className="block text-base font-semibold text-foreground">
                    {babyStatus.child_name}
                  </Text>
                  <Badge className={`${getStatusColor(babyStatus.attendance_status)} text-xs mt-1`}>
                    <Text className="text-xs">{getStatusText(babyStatus.attendance_status)}</Text>
                  </Badge>
                </View>
              </View>

              {/* 今日反馈摘要 */}
              {babyStatus.latest_feedback && (
                <View className="flex gap-4 pt-3 border-t border-border">
                  <View className="flex items-center gap-1">
                    <Text className="text-sm">{getEmoji(babyStatus.latest_feedback.meal_status)}</Text>
                    <Text className="text-xs text-muted-foreground">饮食</Text>
                  </View>
                  <View className="flex items-center gap-1">
                    <Text className="text-sm">{getEmoji(babyStatus.latest_feedback.sleep_status)}</Text>
                    <Text className="text-xs text-muted-foreground">睡眠</Text>
                  </View>
                  <View className="flex items-center gap-1">
                    <Text className="text-sm">{getEmoji(babyStatus.latest_feedback.mood_status)}</Text>
                    <Text className="text-xs text-muted-foreground">情绪</Text>
                  </View>
                </View>
              )}

              {/* 接送时间 */}
              {(babyStatus.check_in_time || babyStatus.check_out_time) && (
                <View className="flex gap-4 pt-3 mt-3 border-t border-border">
                  {babyStatus.check_in_time && (
                    <View>
                      <Text className="block text-xs text-muted-foreground">入园</Text>
                      <Text className="block text-sm text-foreground">
                        {new Date(babyStatus.check_in_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}
                  {babyStatus.check_out_time && (
                    <View>
                      <Text className="block text-xs text-muted-foreground">离园</Text>
                      <Text className="block text-sm text-foreground">
                        {new Date(babyStatus.check_out_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {/* 快捷入口 */}
        <View className="grid grid-cols-3 gap-3">
          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/pickup/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                <Bus size={20} color="#3B82F6" />
              </View>
              <Text className="text-xs text-foreground">接送记录</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.switchTab({ url: '/pages/records/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <BookOpen size={20} color="#22C55E" />
              </View>
              <Text className="text-xs text-foreground">每日反馈</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/growth/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-2">
                <Camera size={20} color="#8B5CF6" />
              </View>
              <Text className="text-xs text-foreground">成长档案</Text>
            </CardContent>
          </Card>
        </View>
      </View>
    )
  }

  // 教师端首页
  if (currentRole?.role_type === 'teacher') {
    return (
      <View className="min-h-screen bg-background p-4">
        <View className="mb-4">
          <Text className="block text-xl font-bold text-foreground">
            你好，{currentRole.real_name || '老师'}
          </Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 班级列表 */}
        {classList.length > 0 ? (
          <View className="space-y-3 mb-4">
            {classList.map((cls) => (
              <Card
                key={cls.id}
                className="bg-white rounded-xl border-0 shadow-sm"
                onClick={() => Taro.navigateTo({ url: `/pages/class-detail/index?id=${cls.id}` })}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between">
                    <View>
                      <Text className="block text-base font-semibold text-foreground">{cls.name}</Text>
                      <Text className="block text-sm text-muted-foreground mt-1">
                        {cls.student_count} 名幼儿
                      </Text>
                    </View>
                    <View className="text-right">
                      <Text className="block text-lg font-bold text-primary">{cls.today_attendance}</Text>
                      <Text className="block text-xs text-muted-foreground">今日出勤</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        ) : (
          <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
            <CardContent className="p-8 flex flex-col items-center">
              <Users size={48} color="#999999" />
              <Text className="block text-sm text-muted-foreground mt-3">暂无班级</Text>
            </CardContent>
          </Card>
        )}

        {/* 快捷入口 */}
        <View className="grid grid-cols-3 gap-3">
          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/roll-call/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center mb-2">
                <ClipboardCheck size={20} color="#E8651A" />
              </View>
              <Text className="text-xs text-foreground">点名</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.switchTab({ url: '/pages/records/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <BookOpen size={20} color="#22C55E" />
              </View>
              <Text className="text-xs text-foreground">日常记录</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                <Users size={20} color="#3B82F6" />
              </View>
              <Text className="text-xs text-foreground">发通知</Text>
            </CardContent>
          </Card>
        </View>
      </View>
    )
  }

  // 管理员端首页
  if (currentRole?.role_type === 'admin') {
    return (
      <View className="min-h-screen bg-background p-4">
        <View className="mb-4">
          <Text className="block text-xl font-bold text-foreground">管理后台</Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 待审核统计 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View>
                <Text className="block text-base font-semibold text-foreground">待处理审核</Text>
                <Text className="block text-sm text-muted-foreground mt-1">家长绑定申请</Text>
              </View>
              <View className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
                <Text className="text-xl font-bold text-yellow-600">{pendingCount}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 管理入口 */}
        <View className="grid grid-cols-2 gap-3">
          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/review/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center mb-2">
                <ShieldCheck size={24} color="#F59E0B" />
              </View>
              <Text className="text-sm text-foreground">绑定审核</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/class-detail/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                <Users size={24} color="#3B82F6" />
              </View>
              <Text className="text-sm text-foreground">班级管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <UserCheck size={24} color="#22C55E" />
              </View>
              <Text className="text-sm text-foreground">幼儿管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center mb-2">
                <BookOpen size={24} color="#8B5CF6" />
              </View>
              <Text className="text-sm text-foreground">发布通知</Text>
            </CardContent>
          </Card>
        </View>
      </View>
    )
  }

  // 无角色
  return (
    <View className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <Text className="block text-base text-muted-foreground">暂无可用角色</Text>
      <Button
        className="mt-4 bg-primary text-primary-foreground"
        onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
      >
        <Text>申请绑定幼儿</Text>
      </Button>
    </View>
  )
}
