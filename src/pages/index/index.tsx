import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { Bus, Users, Camera, GraduationCap, Plus, ChevronDown, ChevronUp, BookOpen, Calendar, X, Info } from 'lucide-react-taro'
import { getRelationshipLabel } from '@/utils/helpers'
import { courseApi } from '@/utils/api'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { formatAge, formatDate, formatTime } from '@/utils/format'

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

interface DailyFeedbackRecord {
  id: string
  feedback_date: string
  meal_status: string | null
  sleep_status: string | null
  mood_status: string | null
  class_id: string | null
  course_id: string | null
  course_name: string | null
  class_name?: string | null
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
  // 日常记录反馈相关
  const [childFeedbacks, setChildFeedbacks] = useState<Record<string, { meal_status: string | null; sleep_status: string | null; mood_status: string | null }>>({})
  const [feedbackChild, setFeedbackChild] = useState<{ id: string; name: string; course_type: string; group_id: string; class_id: string; course_id: string; course_name: string } | null>(null)
  const [feedbackMealStatus, setFeedbackMealStatus] = useState('')
  const [feedbackSleepStatus, setFeedbackSleepStatus] = useState('')
  const [feedbackMoodStatus, setFeedbackMoodStatus] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [mealInfoOpen, setMealInfoOpen] = useState(false)
  const [napInfoOpen, setNapInfoOpen] = useState(false)
  const [moodInfoOpen, setMoodInfoOpen] = useState(false)
  const [courseList, setCourseList] = useState<{ id: string; name: string; class_id: string }[]>([])
  // 家长端今日记录
  const [todayFeedbacks, setTodayFeedbacks] = useState<DailyFeedbackRecord[]>([])
  const [parentMealInfoOpen, setParentMealInfoOpen] = useState(false)
  const [parentNapInfoOpen, setParentNapInfoOpen] = useState(false)
  const [parentMoodInfoOpen, setParentMoodInfoOpen] = useState(false)
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

    // 加载今日日常记录
    if (currentChildId) {
      const today = new Date().toISOString().split('T')[0]
      const fbRes = await Network.request({
        url: '/api/parent/daily-feedbacks',
        method: 'GET',
        data: { child_id: currentChildId, feedback_date: today },
      })
      console.log('[Index] today feedbacks:', fbRes.data)
      if (fbRes.data?.code === 200 && Array.isArray(fbRes.data.data)) {
        setTodayFeedbacks(fbRes.data.data)
      }
    }
  }

  const loadChildFeedbacks = async () => {
    try {
      const feedbackRes = await Network.request({ url: '/api/teachers/feedbacks', method: 'GET' })
      console.log('[Index] today feedbacks:', feedbackRes.data)
      if (feedbackRes.data?.data) {
        const list = Array.isArray(feedbackRes.data.data) ? feedbackRes.data.data : []
        const map: Record<string, { meal_status: string | null; sleep_status: string | null; mood_status: string | null }> = {}
        list.forEach((f: any) => {
          if (f.child_id) {
            map[f.child_id + '_' + (f.group_id || '')] = { meal_status: f.meal_status, sleep_status: f.sleep_status, mood_status: f.mood_status }
          }
        })
        setChildFeedbacks(map)
      }
    } catch (e) {
      console.log('[Index] load feedbacks failed:', e)
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
        courseApi.list({ weekday: new Date().getDay() }),
      ])
      console.log('[Index] grouped overview:', groupRes.data)
      if (groupRes.data?.data) {
        setGroupList(groupRes.data.data)
      }
      if (courseRes.code === 200) {
        const list = Array.isArray(courseRes.data) ? courseRes.data : courseRes.data?.list || []
        setCourseList(list)
        // 从 courses 表构建颜色映射
        const colors = ['bg-orange-50 text-orange-700 border-orange-200','bg-sky-50 text-sky-700 border-sky-200','bg-indigo-50 text-indigo-700 border-indigo-200','bg-purple-50 text-purple-700 border-purple-200','bg-pink-50 text-pink-700 border-pink-200','bg-teal-50 text-teal-700 border-teal-200','bg-green-50 text-green-700 border-green-200','bg-rose-50 text-rose-700 border-rose-200']
        const colorMap: Record<string, string> = {}
        list.forEach((c: any, i: number) => {
          colorMap[c.name] = colors[i % colors.length]
        })
        setCourseColors(colorMap)
      }
      // 加载今日日常记录
      await loadChildFeedbacks()
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
      case 'full_day': return '全天出勤'
      case 'half_day': return '半天出勤'
      case 'absent': return '未入园'
      case 'leave': return '请假'
      default: return '未知'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700'
      case 'full_day': return 'bg-green-100 text-green-700'
      case 'half_day': return 'bg-green-50 text-green-600'
      case 'absent': return 'bg-yellow-100 text-yellow-700'
      case 'leave': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
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
            您好，{currentChild ? `${currentChild.name}${
              currentChild.relationship === 'other' && currentChild.custom_relationship
                ? currentChild.custom_relationship
                : (getRelationshipLabel(currentChild.relationship) === '其他' ? '家长' : getRelationshipLabel(currentChild.relationship) || '家长')
            }` : '新用户'}
          </Text>
          <Text className="block text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 多孩切换 + 添加幼儿 */}
        {children.length > 0 && (
          <ScrollView scrollX className="mb-4 scrollbar-hide" showScrollbar={false}>
            <View className="flex flex-row gap-2 items-center">
              {children.map((child, index) => (
                <View
                  key={child.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap ${
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
                  <Text className="text-sm font-medium truncate max-w-24">
                    {child.name}
                  </Text>
                </View>
              ))}
              {/* 添加幼儿按钮 */}
              <View
                className="flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-dashed border-primary whitespace-nowrap"
                onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
              >
                <Plus size={16} color="#E8651A" />
                <Text className="text-sm text-primary">添加幼儿</Text>
              </View>
            </View>
          </ScrollView>
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
                    <View className="flex items-baseline">
                      <Text className="block text-base font-semibold text-foreground">
                        {currentChild?.name || babyStatus.child_name}
                      </Text>
                      {currentChild?.nickname && <Text className="text-xs text-muted-foreground">（{currentChild.nickname}）</Text>}
                    </View>
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
                      Taro.navigateTo({ url: `/pages/admin/child-detail/index?id=${childId}&readonly=true` })
                    } else {
                      Taro.showToast({ title: '幼儿信息不存在', icon: 'none' })
                    }
                  }}
                >
                  <Text className="text-xs">详情</Text>
                </Button>
              </View>

              {/* 今日记录 - 按课程分行 */}
              <View className="pt-3 border-t border-border">
                <Text className="block text-sm font-medium text-foreground mb-2">今日记录</Text>
                {todayFeedbacks.length > 0 ? (
                  <View className="space-y-2">
                    {todayFeedbacks.map((record, idx) => {
                      const renderStars = (v: string | null | undefined) => {
                        const n = parseInt(v || '0', 10)
                        return n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : ''
                      }
                      return (
                        <View key={record.id || idx} className="py-1">
                          <Text className="block text-xs text-muted-foreground mb-1">
                            {record.class_name || ''}{record.class_name && record.course_name ? ' · ' : ''}{record.course_name || ''}
                          </Text>
                          <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px' }}>
                            {record.meal_status && parseInt(record.meal_status, 10) > 0 && (
                              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text className="text-xs text-gray-500">餐食</Text>
                                <Text style={{ fontSize: 14, color: '#E8651A' }}>{renderStars(record.meal_status)}</Text>
                                <View
                                  onClick={(e) => { e.stopPropagation(); setParentMealInfoOpen(true) }}
                                  style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>i</Text>
                                </View>
                              </View>
                            )}
                            {record.sleep_status && parseInt(record.sleep_status, 10) > 0 && (
                              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text className="text-xs text-gray-500">午睡</Text>
                                <Text style={{ fontSize: 14, color: '#E8651A' }}>{renderStars(record.sleep_status)}</Text>
                                <View
                                  onClick={(e) => { e.stopPropagation(); setParentNapInfoOpen(true) }}
                                  style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>i</Text>
                                </View>
                              </View>
                            )}
                            {record.mood_status && parseInt(record.mood_status, 10) > 0 && (
                              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text className="text-xs text-gray-500">情绪</Text>
                                <Text style={{ fontSize: 14, color: '#E8651A' }}>{renderStars(record.mood_status)}</Text>
                                <View
                                  onClick={(e) => { e.stopPropagation(); setParentMoodInfoOpen(true) }}
                                  style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>i</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <Text className="block text-xs text-gray-400">今日暂无记录</Text>
                )}
              </View>

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

        {/* 家长端评分说明弹窗 */}
        {parentMealInfoOpen && (
          <View
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setParentMealInfoOpen(false)}
          >
            <View
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text className="block text-lg font-bold text-foreground">餐食评分说明</Text>
                <View onClick={() => setParentMealInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#6b7280" />
                </View>
              </View>
              {[
                { star: '★★★★★', desc: '自主光盘，主动添饭，不挑食' },
                { star: '★★★★☆', desc: '少量剩菜，无需喂食' },
                { star: '★★★☆☆', desc: '一半饭菜，需要简单提醒' },
                { star: '★★☆☆☆', desc: '进食很少，全程老师喂饭' },
                { star: '★☆☆☆☆', desc: '拒食、哭闹，进食不足 1/3' },
              ].map((item) => (
                <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                  <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {parentNapInfoOpen && (
          <View
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setParentNapInfoOpen(false)}
          >
            <View
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text className="block text-lg font-bold text-foreground">午睡评分说明</Text>
                <View onClick={() => setParentNapInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#6b7280" />
                </View>
              </View>
              {[
                { star: '★★★★★', desc: '自主快速入睡，睡眠质量高，按时起床' },
                { star: '★★★★☆', desc: '自主入睡较快，睡眠安稳' },
                { star: '★★★☆☆', desc: '需要简单安抚，入睡较慢' },
                { star: '★★☆☆☆', desc: '入睡困难，需老师长时间陪伴' },
                { star: '★☆☆☆☆', desc: '哭闹不睡，全程需老师安抚' },
              ].map((item) => (
                <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                  <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {parentMoodInfoOpen && (
          <View
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setParentMoodInfoOpen(false)}
          >
            <View
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text className="block text-lg font-bold text-foreground">情绪评分说明</Text>
                <View onClick={() => setParentMoodInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#6b7280" />
                </View>
              </View>
              {[
                { star: '★★★★★', desc: '全天心情愉悦，自主参与活动、社交' },
                { star: '★★★★☆', desc: '状态平稳，轻微分心走神，简单引导即可' },
                { star: '★★★☆☆', desc: '情绪小幅起伏，陪伴安抚1-2分钟就能平复' },
                { star: '★★☆☆☆', desc: '低落烦躁易怒，抗拒活动、争抢玩具，需长时间安抚' },
                { star: '★☆☆☆☆', desc: '情绪崩溃失控，抗拒吃饭，安抚半小时仍无法平复' },
              ].map((item) => (
                <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                  <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
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
            onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}
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
                                full_day: { label: '全天出勤', bg: 'bg-green-100', text: 'text-green-700' },
                                half_day: { label: '半天出勤', bg: 'bg-green-50', text: 'text-green-600' },
                                absent: { label: '缺勤', bg: 'bg-yellow-100', text: 'text-yellow-700' },
                                leave: { label: '请假', bg: 'bg-red-100', text: 'text-red-700' },
                              }
                              const config = statusConfig[child.attendance_status] || { label: '未考勤', bg: 'bg-gray-100', text: 'text-gray-500' }
                              const dateRange = child.start_date
                                ? `${formatDate(child.start_date)} ~ ${formatDate(child.extended_end_date || child.end_date)}`
                                : null
                              // 到期标签
                              const endDateStr = child.extended_end_date || child.end_date
                              let expiryTag: { text: string; className: string } | null = null
                              if (endDateStr) {
                                const endDate = new Date(endDateStr)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                endDate.setHours(0, 0, 0, 0)
                                const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                if (diffDays >= 0 && diffDays <= 10) {
                                  expiryTag = { text: '即将到期', className: 'bg-[#E8651A] text-white text-[10px] rounded-full px-1 ml-1' }
                                } else if (endDate.getMonth() === today.getMonth() && endDate.getFullYear() === today.getFullYear()) {
                                  expiryTag = { text: '本月到期', className: 'bg-[#FFE4E1] text-[#D44A5C] text-[10px] rounded-full px-1 ml-1' }
                                }
                              }
                              const childFeedback = childFeedbacks[child.id]
                              const hasMeal = childFeedback?.meal_status && parseInt(childFeedback.meal_status, 10) > 0
                              const hasSleep = childFeedback?.sleep_status && parseInt(childFeedback.sleep_status, 10) > 0
                              const hasMood = childFeedback?.mood_status && parseInt(childFeedback.mood_status, 10) > 0
                              const hasAnyStars = hasMeal || hasSleep || hasMood
                              const renderStars = (v: string | null | undefined) => {
                                const n = parseInt(v || '0', 10)
                                return n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : ''
                              }
                              // 无记录时只显示课程日期，不显示空星
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
                                    {hasAnyStars && (
                                      <View className="mt-1">
                                        <View className="flex flex-row items-center gap-3">
                                          {hasMeal && <Text className="text-xs text-[#E8651A]">餐食{renderStars(childFeedback.meal_status)}</Text>}
                                          {hasSleep && <Text className="text-xs text-[#E8651A]">午睡{renderStars(childFeedback.sleep_status)}</Text>}
                                        </View>
                                        {hasMood && <Text className="block text-xs text-[#E8651A] mt-1">情绪{renderStars(childFeedback.mood_status)}</Text>}
                                      </View>
                                    )}
                                    {dateRange && (
                                      <Text className="block text-xs text-muted-foreground mt-1">
                                        {dateRange}
                                        {expiryTag && <Text className={expiryTag.className}>{expiryTag.text}</Text>}
                                      </Text>
                                    )}
                                  </View>
                                  <View
                                    className={`px-2 py-1 rounded flex items-center justify-center ${config.bg}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // 仅出勤类状态（全天出勤/半天出勤/出勤）才弹出日常记录
                                      const attdTypes = ['present', 'full_day', 'half_day']
                                      if (!attdTypes.includes(child.attendance_status)) return
                                      const course = courseList.find(c => c.name === group.course_type)
                                      setFeedbackChild({
                                        id: child.id,
                                        name: child.name,
                                        course_type: group.course_type || '',
                                        group_id: group.group_id,
                                        class_id: (child as any).class_id || '',
                                        course_id: course?.id || '',
                                        course_name: course?.name || group.course_type || '',
                                      })
                                      setFeedbackMealStatus(childFeedback?.meal_status || '')
                                      setFeedbackSleepStatus(childFeedback?.sleep_status || '')
                                      setFeedbackMoodStatus(childFeedback?.mood_status || '')
                                    }}
                                  >
                                    <Text className={`block text-xs font-medium text-center leading-normal ${config.text}`}>{config.label}</Text>
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
        <View className="grid grid-cols-2 gap-3">
          <Card
            className="bg-white rounded-xl border-0 shadow-sm"
            onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}
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
        </View>  {/* end of p-4 content wrapper */}

        {/* 日常记录底部抽屉 */}
        {feedbackChild && (
          <View>
            <View
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onClick={() => setFeedbackChild(null)}
            />
            <View
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
                backgroundColor: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <View style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
                <Text className="block text-base font-semibold text-foreground text-center">
                  {feedbackChild.name} - 日常记录
                </Text>
              </View>

              <View style={{ padding: '16px 20px 120px' }}>
                {[
                  { label: '餐食', value: feedbackMealStatus, setter: setFeedbackMealStatus },
                  { label: '午睡', value: feedbackSleepStatus, setter: setFeedbackSleepStatus },
                  { label: '情绪', value: feedbackMoodStatus, setter: setFeedbackMoodStatus },
                ].map(({ label, value, setter }) => (
                  <View className="mb-4" key={label}>
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text className="text-sm font-medium text-foreground">{label}</Text>
                      {label === '餐食' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setMealInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                      {label === '午睡' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setNapInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                      {label === '情绪' && (
                        <View
                          style={{
                            width: 20, height: 20, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); setMoodInfoOpen(true) }}
                        >
                          <Info size={12} color="#9ca3af" />
                        </View>
                      )}
                    </View>
                    <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = (parseInt(value || '0', 10) || 0) >= star
                        return (
                          <View
                            key={star}
                            style={{
                              width: 48, height: 48, borderRadius: 8,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: 'transparent',
                            }}
                            onClick={() => setter(parseInt(value || '0', 10) === star && star === 1 ? '' : String(star))}
                          >
                            <Text style={{ fontSize: 28, color: filled ? '#E8651A' : '#d1d5db' }}>
                              {filled ? '★' : '☆'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                ))}

                {/* 保存按钮 - 流式布局 */}
                <View
                  style={{
                    width: '100%', padding: '12px 0', marginTop: '8px'
                  }}
                >
                  <View
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: '12px', textAlign: 'center',
                      backgroundColor: feedbackSubmitting ? '#d1d5db' : '#E8651A'
                    }}
                    onClick={async () => {
                      if (feedbackSubmitting) return
                      setFeedbackSubmitting(true)
                      try {
                        const res = await Network.request({
                          url: '/api/teachers/feedback',
                          method: 'POST',
                          data: {
                            child_id: feedbackChild.id,
                            teacher_role_id: currentRole?.id,
                            group_id: feedbackChild.group_id,
                            class_id: feedbackChild.class_id || '',
                            course_id: feedbackChild.course_id || '',
                            course_name: feedbackChild.course_name || '',
                            meal_status: feedbackMealStatus,
                            sleep_status: feedbackSleepStatus,
                            mood_status: feedbackMoodStatus,
                          },
                        })
                        console.log('[Index] save feedback:', res.data)
                        if (res.data?.code === 200) {
                          await loadChildFeedbacks()
                          setFeedbackChild(null)
                        }
                      } catch (e) {
                        console.error('[Index] save feedback error:', e)
                        Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
                      } finally {
                        setFeedbackSubmitting(false)
                      }
                    }}
                  >
                    <Text style={{ fontSize: '15px', fontWeight: 500, color: feedbackSubmitting ? '#6b7280' : '#fff' }}>
                      {feedbackSubmitting ? '保存中...' : '保存记录'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 餐食评分说明弹窗 */}
            {mealInfoOpen && (
              <View
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={() => setMealInfoOpen(false)}
              >
                <View
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text className="block text-lg font-bold text-foreground">餐食评分说明</Text>
                    <View onClick={() => setMealInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} color="#6b7280" />
                    </View>
                  </View>
                  {[
                    { star: '★★★★★', desc: '自主光盘，主动添饭，不挑食' },
                    { star: '★★★★☆', desc: '少量剩菜，无需喂食' },
                    { star: '★★★☆☆', desc: '一半饭菜，需要简单提醒' },
                    { star: '★★☆☆☆', desc: '进食很少，全程老师喂饭' },
                    { star: '★☆☆☆☆', desc: '拒食、哭闹，进食不足 1/3' },
                  ].map((item) => (
                    <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                      <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {/* 午睡评分说明弹窗 */}
            {napInfoOpen && (
              <View
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={() => setNapInfoOpen(false)}
              >
                <View
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text className="block text-lg font-bold text-foreground">午睡评分说明</Text>
                    <View onClick={() => setNapInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} color="#6b7280" />
                    </View>
                  </View>
                  {[
                    { star: '★★★★★', desc: '自主快速入睡，睡眠质量高，按时起床' },
                    { star: '★★★★☆', desc: '自主入睡较快，睡眠安稳' },
                    { star: '★★★☆☆', desc: '需要简单安抚，入睡较慢' },
                    { star: '★★☆☆☆', desc: '入睡困难，需老师长时间陪伴' },
                    { star: '★☆☆☆☆', desc: '哭闹不睡，全程需老师安抚' },
                  ].map((item) => (
                    <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                      <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {/* 情绪评分说明弹窗 */}
            {feedbackChild && moodInfoOpen && (
              <View
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={() => setMoodInfoOpen(false)}
              >
                <View
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '70vh', overflowY: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text className="block text-lg font-bold text-foreground">情绪评分说明</Text>
                    <View onClick={() => setMoodInfoOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} color="#6b7280" />
                    </View>
                  </View>
                  {[
                    { star: '★★★★★', desc: '全天心情愉悦，自主参与活动、社交' },
                    { star: '★★★★☆', desc: '状态平稳，轻微分心走神，简单引导即可' },
                    { star: '★★★☆☆', desc: '情绪小幅起伏，陪伴安抚1-2分钟就能平复' },
                    { star: '★★☆☆☆', desc: '低落烦躁易怒，抗拒活动、争抢玩具，需长时间安抚' },
                    { star: '★☆☆☆☆', desc: '情绪崩溃失控，抗拒吃饭，安抚半小时仍无法平复' },
                  ].map((item) => (
                    <View key={item.star} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <Text style={{ fontSize: 16, color: '#E8651A', marginRight: 12, width: 80, flexShrink: 0 }}>{item.star}</Text>
                      <Text className="block text-sm text-gray-600 flex-1">{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            </View>
          )}
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
            onClick={() => Taro.navigateTo({ url: '/pages/roll-call/index' })}
          >
            <CardContent className="p-4 flex flex-col items-center">
              <View className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center mb-2">
                <Calendar size={24} color="#14B8A6" />
              </View>
              <Text className="text-sm text-foreground">考勤管理</Text>
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
