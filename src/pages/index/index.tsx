import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { Bus, Users, Camera, GraduationCap, Plus, ChevronDown, ChevronUp, BookOpen, Calendar } from 'lucide-react-taro'
import { courseApi } from '@/utils/api'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge, formatTime } from '@/utils/format'

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

interface GroupOverview {
  group_id: string
  class_id: string
  class_name: string
  room: string | null
  course_type: string
  student_count: number
  today_attendance: { present: number; absent: number; leave: number }
  students: Array<{
    id: string
    name: string
    gender: string
    birth_date: string
    attendance_status: string
    start_date: string | null
    end_date: string | null
    extended_end_date: string | null
  }>
}

const courseTypeColors: Record<string, string> = {
  '全日托': 'bg-orange-50 text-orange-700 border-orange-200',
  '半日托': 'bg-sky-50 text-sky-700 border-sky-200',
  '周六托': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '晚间托': 'bg-purple-50 text-purple-700 border-purple-200',
  '兴趣班': 'bg-pink-50 text-pink-700 border-pink-200',
  '计日': 'bg-teal-50 text-teal-700 border-teal-200',
}

export default function IndexPage() {
  const { isLoggedIn, currentRole, isLoading, fetchUserInfo, children, currentChildIndex, setCurrentChild, nickname } = useAppStore()
  const [babyStatus, setBabyStatus] = useState<BabyStatus | null>(null)
  const [groupList, setGroupList] = useState<GroupOverview[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pageLoading, setPageLoading] = useState(true)
  const [storeReady, setStoreReady] = useState(false)
  const [expandedGroupId, setExpandedGroupId] = useState<Set<string>>(new Set())
  const [courseColors, setCourseColors] = useState<Record<string, string>>(courseTypeColors)
  const currentChild = children[currentChildIndex] || null

  // 等待 store 从持久化中恢复
  useEffect(() => {
    // 检查 store 是否已恢复（通过检查 hasHydrated 或简单延迟）
    const timer = setTimeout(() => {
      setStoreReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!storeReady) return
    
    // 检查登录状态
    if (!isLoggedIn) {
      // 未登录，跳转到登录页
      Taro.redirectTo({ url: '/pages/login/index' })
    } else {
      fetchUserInfo()
    }
  }, [storeReady, isLoggedIn])

  useEffect(() => {
    if (isLoggedIn && currentRole) {
      loadPageData()
    }
  }, [isLoggedIn, currentRole, currentChildIndex])

  // 页面显示时重新加载数据（处理审核后返回的情况）
  useDidShow(() => {
    const currentState = useAppStore.getState()
    const roleType = currentState.currentRole?.role_type
    console.log('[Index] useDidShow, roleType:', roleType)
    if (currentState.isLoggedIn && currentState.currentRole) {
      // 先刷新 store 中的用户信息（包含 children），再加载页面数据
      currentState.fetchUserInfo().then(() => {
        loadPageData(roleType)
      }).catch(() => {
        loadPageData(roleType)
      })
      
      // 如果有展开的分组，重新加载分组数据
      if (expandedGroupId.size > 0) {
        const tid = Taro.getStorageSync('teacherId') || currentState.currentRole?.id
        if (tid) {
          Network.request({
            url: '/api/teachers/grouped-overview',
            method: 'GET',
            data: { teacher_role_id: tid },
          }).then((res: any) => {
            if (res.data?.data) {
              setGroupList(res.data.data)
            }
          }).catch((err: any) => {
            console.error('[Index] refresh groups error:', err)
          })
        }
      }
    }
  })

  const loadPageData = async (roleType?: string | null) => {
    // 直接从 store 获取最新角色，避免闭包捕获旧值
    const latestRole = useAppStore.getState().currentRole
    const type = roleType || latestRole?.role_type
    console.log('[Index] loadPageData, roleType:', type)
    setPageLoading(true)
    try {
      if (type === 'parent') {
        await loadParentData()
      } else if (type === 'teacher') {
        await loadTeacherData()
      } else if (type === 'admin') {
        await loadAdminData()
      }
    } catch (err) {
      console.error('[Index] loadPageData error:', err)
    }
    setPageLoading(false)
  }

  const loadParentData = async () => {
    const currentChildId = currentChild?.id || currentChild?.child_id
    const url = currentChildId ? `/api/parent/baby-status?childId=${currentChildId}` : '/api/parent/baby-status'
    const res = await Network.request({
      url,
      method: 'GET',
    })
    console.log('[Index] baby status:', res.data)
    if (res.data?.data) {
      setBabyStatus(res.data.data)
    }
  }

  const loadTeacherData = async () => {
    const teacherId = Taro.getStorageSync('teacherId') || currentRole?.id
    if (teacherId) {
      const [groupRes, courseRes] = await Promise.all([
        Network.request({
          url: '/api/teachers/grouped-overview',
          method: 'GET',
          data: { teacher_role_id: teacherId },
        }),
        courseApi.list(),
      ])
      console.log('[Index] grouped overview:', groupRes.data)
      if (groupRes.data?.data) {
        setGroupList(groupRes.data.data)
      }
      if (courseRes.code === 200) {
        const list = Array.isArray(courseRes.data) ? courseRes.data : courseRes.data?.list || []
        // 从 courses 表构建颜色映射
        const colors = ['bg-orange-50 text-orange-700 border-orange-200','bg-sky-50 text-sky-700 border-sky-200','bg-indigo-50 text-indigo-700 border-indigo-200','bg-purple-50 text-purple-700 border-purple-200','bg-pink-50 text-pink-700 border-pink-200','bg-teal-50 text-teal-700 border-teal-200','bg-green-50 text-green-700 border-green-200','bg-rose-50 text-rose-700 border-rose-200']
        const colorMap: Record<string, string> = {}
        list.forEach((c: any, i: number) => {
          colorMap[c.name] = colors[i % colors.length]
        })
        setCourseColors(colorMap)
      }
    }
  }

  const loadAdminData = async () => {
    const res = await Network.request({
      url: '/api/admin/pending-count',
      method: 'GET',
    })
    console.log('[Index] pending count:', res.data)
    if (res.data?.data) {
      const count = res.data.data.count || 0
      setPendingCount(count)
      // 控制底部导航栏红点
      if (count > 0) {
        Taro.showTabBarRedDot({ index: 0 })
      } else {
        Taro.hideTabBarRedDot({ index: 0 })
      }
    }
  }

  // 监听审核刷新事件
  useEffect(() => {
    const handler = () => {
      if (currentRole?.role_type === 'admin') {
        loadAdminData()
      }
    }
    Taro.eventCenter.on('refreshPendingCount', handler)
    return () => {
      Taro.eventCenter.off('refreshPendingCount', handler)
    }
  }, [currentRole])

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
      case 'absent': return 'bg-yellow-100 text-yellow-700'
      case 'leave': return 'bg-red-100 text-red-700'
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
            你好，{currentChild ? `${currentChild.name}${
              currentChild.relationship === 'father' ? '爸爸' :
              currentChild.relationship === 'mother' ? '妈妈' :
              currentChild.relationship === 'grandfather' ? '爷爷' :
              currentChild.relationship === 'grandmother' ? '奶奶' :
              currentChild.relationship === 'other' && currentChild.custom_relationship ? currentChild.custom_relationship : '家长'
            }` : '新用户'}
          </Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 多孩切换 + 添加幼儿 */}
        {children.length > 0 && (
          <View className="mb-4 flex gap-2 overflow-x-auto items-center">
            {children.map((child, index) => (
              <View
                key={child.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                  index === currentChildIndex
                    ? 'bg-primary text-white'
                    : 'bg-white text-foreground'
                }`}
                onClick={() => setCurrentChild(index)}
              >
                <View className="w-6 h-6 rounded-full bg-white bg-opacity-30 flex items-center justify-center overflow-hidden">
                  <Image
                    src={rabbitLogo}
                    className="w-6 h-6 rounded-full"
                    mode="aspectFit"
                  />
                </View>
                <Text className="text-sm font-medium">{child.name}</Text>
              </View>
            ))}
            {/* 添加幼儿按钮 */}
            <View
              className="flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-dashed border-primary"
              onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
            >
              <Plus size={16} color="#E8651A" />
              <Text className="text-sm text-primary">添加幼儿</Text>
            </View>
          </View>
        )}

        {/* 宝宝状态卡片 - 仅在已绑定幼儿时显示 */}
        {children.length > 0 && babyStatus && (
          <Card className="mb-4 bg-white rounded-xl border-0 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center gap-3 mb-3">
                <View className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  <Image
                    src={rabbitLogo}
                    className="w-12 h-12 rounded-full"
                    mode="aspectFit"
                  />
                </View>
                <View className="flex-1">
                  <View className="flex items-center gap-2">
                    <Text className="block text-base font-semibold text-foreground">
                      {currentChild?.name || babyStatus.child_name}
                    </Text>
                    <Badge className={`${getStatusColor(babyStatus.attendance_status)} text-xs`}>
                      <Text className="text-xs">{getStatusText(babyStatus.attendance_status)}</Text>
                    </Badge>
                  </View>
                  {currentChild?.birth_date && (
                    <Text className="block text-xs text-muted-foreground mt-1">
                      {formatAge(currentChild.birth_date)}
                    </Text>
                  )}
                  {/* 过敏情况 - 紧跟年龄下方 */}
                  <Text className="block text-xs text-muted-foreground mt-1">
                    过敏：{currentChild?.allergies || '无'}
                  </Text>
                </View>
                <Button
                  className="bg-primary text-white rounded-lg px-3 py-1 text-xs"
                  onClick={() => {
                    const childId = currentChild?.id || currentChild?.child_id || babyStatus?.child_id
                    console.log('[Index] 点击详情按钮, childId:', childId, 'currentChild:', currentChild)
                    if (childId && childId !== 'demo') {
                      Taro.navigateTo({ url: `/pages/child-setting/index?childId=${childId}` })
                    } else {
                      Taro.showToast({ title: '幼儿信息不存在', icon: 'none' })
                    }
                  }}
                >
                  <Text className="text-xs">详情</Text>
                </Button>
              </View>

              {/* 今日反馈摘要 - 移到过敏情况下方 */}
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
                  {babyStatus.check_in_time && formatTime(babyStatus.check_in_time) && (
                    <View>
                      <Text className="block text-xs text-muted-foreground">入园</Text>
                      <Text className="block text-sm text-foreground">
                        {formatTime(babyStatus.check_in_time)}
                      </Text>
                    </View>
                  )}
                  {babyStatus.check_out_time && formatTime(babyStatus.check_out_time) && (
                    <View>
                      <Text className="block text-xs text-muted-foreground">离园</Text>
                      <Text className="block text-sm text-foreground">
                        {formatTime(babyStatus.check_out_time)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {/* 未绑定孩子提示 */}
        {children.length === 0 && (
          <Card className="mb-4 bg-yellow-50 border-0 rounded-xl">
            <CardContent className="p-4 flex flex-col items-center">
              <Text className="block text-sm text-yellow-800 text-center mb-3">
                您还没有绑定幼儿，请先绑定后才能查看宝宝信息
              </Text>
              <Button
                className="bg-primary text-white rounded-lg px-6"
                onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
              >
                <Text>立即绑定</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 快捷入口 - 已绑定幼儿后才显示 */}
        {children.length > 0 && (
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
                <Text className="text-green-500 text-xl leading-none">📖</Text>
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
        )}
      </View>
    )
  }

  // 教师端首页
  if (currentRole?.role_type === 'teacher') {
    return (
      <View className="min-h-screen bg-background p-4">
        <View className="mb-4">
          <Text className="block text-xl font-bold text-foreground">
            您好，{nickname || currentRole?.real_name || '老师'} 💕
          </Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 课程类型分组卡片 */}
        {groupList.length > 0 ? (
          <View className="mb-4">
            {groupList.map((group) => {
              const isExpanded = expandedGroupId.has(group.group_id)
              return (
                <Card key={group.group_id} className="bg-white rounded-xl border-0 shadow-sm mb-3">
                  <CardContent className="p-0">
                    {/* 卡片头部 */}
                    <View
                      className="flex items-center justify-between p-4"
                      onClick={() => {
                        const next = new Set(expandedGroupId)
                        if (next.has(group.group_id)) {
                          next.delete(group.group_id)
                        } else {
                          next.add(group.group_id)
                        }
                        setExpandedGroupId(next)
                      }}
                    >
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="block text-base font-semibold text-foreground">
                            {group.class_name}
                          </Text>
                          <View className={`text-xs px-2 py-1 rounded-full border ${courseColors[group.course_type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            <Text className="text-xs font-medium">{group.course_type}</Text>
                          </View>
                        </View>
                        {group.room && (
                          <Text className="block text-xs text-muted-foreground mb-1">
                            {group.room}
                          </Text>
                        )}
                        <Text className="block text-sm text-muted-foreground">
                          {group.student_count} 名幼儿 · 出勤 {group.today_attendance.present} 人 · 缺勤 {group.today_attendance.absent} 人 · 请假 {group.today_attendance.leave} 人
                        </Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={20} color="#999" />
                      ) : (
                        <ChevronDown size={20} color="#999" />
                      )}
                    </View>

                    {/* 展开内容 - 幼儿列表 */}
                    {isExpanded && (
                      <View className="border-t border-gray-100 p-4">
                        {group.students.length > 0 ? (
                          <View className="space-y-1">
                            {group.students.map((child) => {
                              const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
                                present: { label: '出勤', bg: 'bg-green-100', text: 'text-green-700' },
                                absent: { label: '缺勤', bg: 'bg-yellow-100', text: 'text-yellow-700' },
                                leave: { label: '请假', bg: 'bg-red-100', text: 'text-red-700' },
                              }
                              const config = statusConfig[child.attendance_status] || { label: '未考勤', bg: 'bg-gray-100', text: 'text-gray-500' }
                              const dateRange = child.start_date || child.extended_end_date
                                ? `${child.start_date || '?'} ~ ${child.extended_end_date || child.end_date || '?'}`
                                : null
                              return (
                                <View
                                  key={child.id}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                  onClick={() => {
                                    Taro.navigateTo({ url: `/pages/admin/child-detail/index?id=${child.id}&readonly=true` })
                                  }}
                                >
                                  <View className={`w-8 h-8 rounded-full flex items-center justify-center ${child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                                    <Text className={`text-sm font-medium ${child.gender === 'male' ? 'text-blue-700' : 'text-pink-700'}`}>
                                      {(child.name || '幼').charAt(0)}
                                    </Text>
                                  </View>
                                  <View className="flex-1">
                                    <Text className="block text-sm text-foreground">
                                      {child.name}
                                      <Text className="text-xs text-muted-foreground ml-1">
                                        {child.gender === 'male' ? '男' : '女'} {formatAge(child.birth_date)}
                                      </Text>
                                    </Text>
                                    {dateRange && (
                                      <Text className="block text-xs text-muted-foreground">{dateRange}</Text>
                                    )}
                                  </View>
                                  <View className={`px-2 py-1 rounded ${config.bg}`}>
                                    <Text className={`text-xs font-medium ${config.text}`}>{config.label}</Text>
                                  </View>
                                </View>
                              )
                            })}
                          </View>
                        ) : (
                          <View className="flex flex-col items-center py-4">
                            <Users size={32} color="#999" />
                            <Text className="block text-sm text-muted-foreground mt-2">暂无幼儿</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </View>
        ) : (
          <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
            <CardContent className="p-8 flex flex-col items-center">
              <Users size={48} color="#999999" />
              <Text className="block text-sm text-muted-foreground mt-3">暂无分组</Text>
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
              <View className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-2">
                <Text className="text-orange-500 text-xl leading-none">📋</Text>
              </View>
              <Text className="text-xs text-foreground">考勤</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.switchTab({ url: '/pages/records/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <Text className="text-green-500 text-xl leading-none">📖</Text>
              </View>
              <Text className="text-xs text-foreground">日常记录</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/teacher-notification/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                <Text className="text-blue-500 text-xl leading-none">📢</Text>
              </View>
              <Text className="text-xs text-foreground">发布通知</Text>
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

        {/* 管理入口 */}
        <View className="grid grid-cols-2 gap-3">
          <Card
            className="bg-white rounded-xl border-0 shadow-sm relative"
            onClick={() => Taro.navigateTo({ url: '/pages/review/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center mb-2">
                <GraduationCap size={24} color="#F59E0B" />
              </View>
              <Text className="text-sm text-foreground">绑定审核</Text>
              {pendingCount > 0 && (
                <View className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 flex items-center justify-center">
                  <Text className="text-xs text-white">{pendingCount > 99 ? '99+' : pendingCount}</Text>
                </View>
              )}
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/class-manage/index' })}
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
            onClick={() => Taro.navigateTo({ url: '/pages/admin/children/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <Users size={24} color="#22C55E" />
              </View>
              <Text className="text-sm text-foreground">幼儿管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/teacher-manage/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center mb-2">
                <Users size={24} color="#8B5CF6" />
              </View>
              <Text className="text-sm text-foreground">教师管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/course-manage/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
                <BookOpen size={24} color="#D97706" />
              </View>
              <Text className="text-sm text-foreground">课程管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/holiday-mgmt/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                <Calendar size={24} color="#16A34A" />
              </View>
              <Text className="text-sm text-foreground">假期管理</Text>
            </CardContent>
          </Card>

          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/notification-manage/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center mb-2">
                <Text className="text-purple-500 text-xl leading-none">📝</Text>
              </View>
              <Text className="text-sm text-foreground">通知管理</Text>
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
