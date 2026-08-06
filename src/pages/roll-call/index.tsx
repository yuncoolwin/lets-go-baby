import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { format } from 'date-fns'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app'
import { ChevronDown, ChevronUp } from 'lucide-react-taro'
import { Network } from '@/network'


interface ChildItem {
  id: string
  name: string
  gender: string
  birth_date?: string
  allergy?: string
  avatar_url?: string
  attendance_status?: string | null
  course_type?: string | null
}

const COURSE_TYPE_COLORS: Record<string, string> = {
  '全日托': 'bg-orange-100 text-orange-700',
  '半日托': 'bg-blue-100 text-blue-700',
  '周六托': 'bg-purple-100 text-purple-700',
  '晚间托': 'bg-indigo-100 text-indigo-700',
  '兴趣班': 'bg-green-100 text-green-700',
  '计日': 'bg-gray-100 text-gray-700',
}

interface AttendanceItem {
  child_id: string
  status: 'full_day' | 'half_day' | 'present' | 'absent' | 'leave' | 'unknown'
}

const STATUS_CONFIG = {
  full_day: { label: '全天', color: 'bg-green-500', text: 'text-white' },
  half_day: { label: '半天', color: 'bg-green-100', text: 'text-green-700' },
  present: { label: '到', color: 'bg-green-500', text: 'text-white' },
  absent: { label: '缺', color: 'bg-yellow-400', text: 'text-yellow-800' },
  leave: { label: '假', color: 'bg-red-500', text: 'text-white' },
  unknown: { label: '—', color: 'bg-gray-100', text: 'text-gray-400' },
} as const

export default function RollCallPage() {
  const { currentRole } = useAppStore()
  const [children, setChildren] = useState<ChildItem[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceItem['status']>>({})
  const [classId, setClassId] = useState('')
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [tempAttendance, setTempAttendance] = useState<Record<string, AttendanceItem['status']>>({})
  const [dateList, setDateList] = useState<string[]>([])
  const [expandedGroup, setExpandedGroup] = useState<Set<string>>(new Set())
  const [expandedAttendStat, setExpandedAttendStat] = useState<string>('')
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [classList, setClassList] = useState<Array<{ id: string; name: string }>>([])
  const [selectedClassId, setSelectedClassId] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadData()
  }, [selectedDate, selectedClassId])

  const loadData = async () => {
    setLoading(true)
    try {
      const isAdminUser = currentRole?.role_type === 'admin'
      setIsAdmin(isAdminUser)

      if (isAdminUser) {
        // 管理员模式：加载所有班级列表
        let allClasses: Array<{ id: string; name: string }> = classList
        if (allClasses.length === 0) {
          const classRes = await Network.request({ url: '/api/classes' })
          allClasses = classRes.data?.data?.list || classRes.data?.data || []
          setClassList(allClasses)
          if (allClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(allClasses[0].id)
            setClassName(allClasses[0].name)
          }
        }

        const currentClassId = selectedClassId || (allClasses.length > 0 ? allClasses[0].id : '')
        if (!currentClassId) {
          setLoading(false)
          return
        }
        setClassId(currentClassId)

        // 加载日期列表
        try {
          const dateRes = await Network.request({
            url: `/api/attendance/dates/${currentClassId}`,
          })
          const dates: string[] = dateRes.data?.data || []
          const todayStr = new Date().toISOString().split('T')[0]
          if (!dates.includes(todayStr)) dates.unshift(todayStr)
          setDateList(dates)
        } catch (e) {
          console.error('[RollCall] load dates error:', e)
        }

        // 使用管理员专用接口查询考勤分组
        const groupedRes = await Network.request({
          url: '/api/attendance/admin/overview',
          data: { class_id: currentClassId, date: selectedDate },
        })
        const groups: any[] = groupedRes.data?.data || []

        // 扁平化所有分组的幼儿数据
        const allChildren: ChildItem[] = []
        const map: Record<string, AttendanceItem['status']> = {}
        groups.forEach(g => {
          (g.students || []).forEach((s: any) => {
            allChildren.push({
              id: s.id,
              name: s.name,
              gender: s.gender,
              course_type: g.course_type,
              attendance_status: s.attendance_status || null,
            })
            const status = s.attendance_status
            if (status === 'present' || status === 'absent' || status === 'leave' || status === 'full_day' || status === 'half_day') {
              map[s.id + '__' + g.course_type] = status
            } else {
              map[s.id + '__' + g.course_type] = 'unknown'
            }
          })
        })
        setChildren(allChildren)
        setAttendance(map)
        setTempAttendance(map)

        const hasRecords = allChildren.some(c => {
          const s = map[c.id + '__' + c.course_type]
          return s === 'present' || s === 'absent' || s === 'leave' || s === 'full_day' || s === 'half_day'
        })
        // 如果是管理员模式，始终不锁定（可编辑所有日期）
      if (isAdminUser) {
        setIsLocked(false)
      } else {
        setIsLocked(hasRecords)
      }
        setLoading(false)
        return
      }

      // 教师模式：原有逻辑
      const teacherId = Taro.getStorageSync('teacherId') || currentRole?.id
      if (!teacherId) {
        setLoading(false)
        return
      }
      
      const teacherRes = await Network.request({
        url: `/api/teachers/${teacherId}`,
      })
      const teacherData = teacherRes.data?.data
      if (!teacherData?.class_id) {
        setLoading(false)
        return
      }
      const theClassId = teacherData.class_id
      setClassId(theClassId)
      setClassName(teacherData.class_name || '')

      // 加载有考勤记录的日期列表
      try {
        const dateRes = await Network.request({
          url: `/api/attendance/dates/${theClassId}`,
        })
        const dates: string[] = dateRes.data?.data || []
        // 确保"今天"始终在列表中
        const todayStr = new Date().toISOString().split('T')[0]
        if (!dates.includes(todayStr)) {
          dates.unshift(todayStr)
        }
        setDateList(dates)
      } catch (e) {
        console.error('[RollCall] load dates error:', e)
      }

      // 使用 grouped-overview 接口获取分组数据（与教师端首页一致）
      const groupedRes = await Network.request({
        url: '/api/teachers/grouped-overview',
        data: { teacher_role_id: teacherId, date: selectedDate },
      })
      const groups: any[] = groupedRes.data?.data || []
      setClassName(teacherData.class_name || '')

      // 扁平化所有分组的幼儿数据
      const allChildren: ChildItem[] = []
      const map: Record<string, AttendanceItem['status']> = {}
      groups.forEach(g => {
        (g.students || []).forEach((s: any) => {
          allChildren.push({
            id: s.id,
            name: s.name,
            gender: s.gender,
            course_type: g.course_type,
            attendance_status: s.attendance_status || null,
          })
          const status = s.attendance_status
          if (status === 'present' || status === 'absent' || status === 'leave' || status === 'full_day' || status === 'half_day') {
            map[s.id + '__' + g.course_type] = status
          } else {
            map[s.id + '__' + g.course_type] = 'unknown'
          }
        })
      })
      setChildren(allChildren)
      setAttendance(map)
      setTempAttendance(map)

      // 如果有考勤记录，自动锁定
      const hasRecords = allChildren.some(c => {
        const s = map[c.id + '__' + c.course_type]
        return s === 'present' || s === 'absent' || s === 'leave' || s === 'full_day' || s === 'half_day'
      })
      setIsLocked(hasRecords)
    } catch (e) {
      console.error('[RollCall] load error:', e)
    }
    setLoading(false)
  }

  const handleStatusChange = (childId: string, status: AttendanceItem['status']) => {
    if (isLocked) return
    const prev = tempAttendance[childId]
    if (prev === status) return
    setTempAttendance(prevAtt => ({ ...prevAtt, [childId]: status }))
    setHasUnsaved(true)
  }

  const handleSave = async () => {
    try {
      // 遍历所有幼儿，包括未考勤的
      for (const child of children) {
        const key = child.id + '__' + child.course_type
        const status = tempAttendance[key]
        // 未考勤的跳过
        if (status === 'unknown') continue
        await Network.request({
          url: '/api/attendance',
          method: 'POST',
          data: {
            child_id: child.id,
            class_id: classId,
            date: selectedDate,
            course_type: child.course_type,
            status,
            teacher_id: currentRole?.id || '',
          },
        })
      }
      setAttendance(tempAttendance)
      setIsLocked(true)
      setHasUnsaved(false)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      if (!isAdmin) {
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleUnlock = () => {
    if (isLocked) {
      setIsLocked(false)
      setTempAttendance(attendance)
    }
  }

  const handleClear = async () => {
    Taro.showModal({
      title: '确认清除',
      content: `确定要清除 ${className} ${selectedDate} 全部考勤记录吗？`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: '/api/attendance/clear',
              method: 'POST',
              data: { class_id: classId, date: selectedDate },
            })
            setAttendance({})
            setTempAttendance({})
            setIsLocked(false)
            setHasUnsaved(false)
            Taro.showToast({ title: '已清除', icon: 'success' })
          } catch (e) {
            Taro.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      },
    })
  }

  const currentDisplay = isLocked ? attendance : tempAttendance

  return (
    <View className="min-h-screen bg-gray-50 pb-safe">
      {/* 头部信息 */}
      <View className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <View onClick={() => setCalendarVisible(true)}>
            <View className="flex items-center flex-row">
              <Text className="block text-sm text-gray-500">{selectedDate === today ? '今天' : selectedDate}</Text>
              <Text className="block text-xs text-gray-300 ml-1">▼</Text>
            </View>
          </View>
          {selectedDate !== today && !isAdmin && (
            <Text className="block text-xs text-orange-500">（历史记录，只读）</Text>
          )}
        </View>
        {(selectedDate === today || isAdmin) && (
          <Text 
            className="block text-sm text-red-500"
            onClick={handleClear}
          >
            清除
          </Text>
        )}
      </View>

      {/* 管理员模式：班级选择器 */}
      {isAdmin && classList.length > 0 && (
        <View className="bg-white px-4 py-2 border-b border-gray-100">
          <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', overflowX: 'auto' }}>
            {classList.map(cls => {
              const isSelected = cls.id === (selectedClassId || classId)
              return (
                <View
                  key={cls.id}
                  className={`px-4 py-1 rounded-full text-sm whitespace-nowrap ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => {
                    if (!isSelected) {
                      setSelectedClassId(cls.id)
                      setClassName(cls.name)
                    }
                  }}
                >
                  <Text className="block text-sm">{cls.name}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      <ScrollView scrollY className="h-[calc(100vh-280px)]">
        {/* 班级信息 */}
        {className && (
          <View className="px-4 pt-4 pb-2">
            <Text className="block text-sm text-gray-500">{className} 考勤分组</Text>
          </View>
        )}

        {loading ? (
          <View className="px-4 space-y-4">
            {Array.from({ length: 2 }).map((_a, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <View className="flex gap-2 mb-3">
                    <View className="h-6 bg-gray-100 rounded w-16 animate-pulse" />
                    <View className="h-6 bg-gray-100 rounded w-24 animate-pulse" />
                  </View>
                  <View className="flex gap-2 mb-4">
                    {Array.from({ length: 4 }).map((_x, j) => (
                      <View key={j} className="flex-1 h-16 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </View>
                  {Array.from({ length: 2 }).map((_b, j) => (
                    <View key={j} className="flex items-center gap-3 mb-3">
                      <View className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                      <View className="h-4 bg-gray-100 rounded flex-1 animate-pulse" />
                      <View className="flex gap-2">
                        <View className="w-12 h-10 rounded-xl bg-gray-100 animate-pulse" />
                        <View className="w-12 h-10 rounded-xl bg-gray-100 animate-pulse" />
                        <View className="w-12 h-10 rounded-xl bg-gray-100 animate-pulse" />
                      </View>
                    </View>
                  ))}
                </CardContent>
              </Card>
            ))}
          </View>
        ) : children.length === 0 ? (
          <View className="text-center py-12">
            <Text className="block text-gray-400">暂无在读幼儿</Text>
          </View>
        ) : (
          (() => {
            // 按课程类型分组
            const sortOrder = ['全日托', '半日托', '周六托', '晚间托', '兴趣班', '计日']
            const groupMap = new Map<string, ChildItem[]>()
            children.forEach(child => {
              const ct = child.course_type || '其他'
              if (!groupMap.has(ct)) groupMap.set(ct, [])
              groupMap.get(ct)!.push(child)
            })
            const sortedGroups = [...groupMap.entries()].sort((a, b) => {
              const ai = sortOrder.indexOf(a[0])
              const bi = sortOrder.indexOf(b[0])
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
            })

            return (
              <View className="px-4 pb-6 space-y-4">
                {sortedGroups.map(([courseType, groupChildren]) => {
                  const present = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'present').length
                  const absent = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'absent').length
                  const leave = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'leave').length
                  const fullDay = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'full_day').length
                  const halfDay = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'half_day').length
                  const totalPresent = courseType === '全日托' ? fullDay + halfDay : present
                  const unrecorded = groupChildren.length - totalPresent - absent - leave
                  const colorClass = COURSE_TYPE_COLORS[courseType] || 'bg-gray-100 text-gray-700'
                  const statExpanded = expandedAttendStat === courseType

                  const isExpanded = expandedGroup.has(courseType)
                  return (
                    <Card key={courseType}>
                      <CardContent className="p-4">
                        {/* 分组头部 — 可点击展开/收起 */}
                        <View
                          className="flex items-center gap-2 active:opacity-60"
                          onClick={() => {
                            const next = new Set(expandedGroup)
                            if (next.has(courseType)) {
                              next.delete(courseType)
                            } else {
                              next.add(courseType)
                            }
                            setExpandedGroup(next)
                          }}
                        >
                          <Badge className={colorClass}>{courseType}</Badge>
                          <Text className="block text-sm text-gray-500 flex-1">{groupChildren.length} 名幼儿</Text>
                          {isExpanded ? (
                            <ChevronUp size={20} color="#999" />
                          ) : (
                            <ChevronDown size={20} color="#999" />
                          )}
                        </View>

                        {/* 展开内容 */}
                        {isExpanded && (
                          <>
                            {/* 分组统计 */}
                            <View className="flex gap-2 mt-4 mb-4">
                              {courseType === '全日托' ? (
                                <>
                                  <View className="flex-1 bg-green-50 rounded-xl py-2 px-3 text-center" onClick={() => setExpandedAttendStat(statExpanded ? '' : courseType)}>
                                    <Text className="block text-xl font-bold text-green-600">{totalPresent}</Text>
                                    <Text className="block text-xs text-green-500">出勤</Text>
                                    {statExpanded && (
                                      <View className="mt-2 pt-2 border-t border-green-200">
                                        <Text className="block text-xs text-green-500">全天 {fullDay}人</Text>
                                        <Text className="block text-xs text-green-500 mt-1">半天 {halfDay}人</Text>
                                      </View>
                                    )}
                                  </View>
                                  <View className="flex-1 bg-yellow-50 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-yellow-600">{absent}</Text>
                                    <Text className="block text-xs text-yellow-500">缺勤</Text>
                                  </View>
                                  <View className="flex-1 bg-red-50 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-red-500">{leave}</Text>
                                    <Text className="block text-xs text-red-400">请假</Text>
                                  </View>
                                  <View className="flex-1 bg-gray-100 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-gray-400">{unrecorded}</Text>
                                    <Text className="block text-xs text-gray-400">未记录</Text>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <View className="flex-1 bg-green-50 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-green-600">{totalPresent}</Text>
                                    <Text className="block text-xs text-green-500">出勤</Text>
                                  </View>
                                  <View className="flex-1 bg-yellow-50 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-yellow-600">{absent}</Text>
                                    <Text className="block text-xs text-yellow-500">缺勤</Text>
                                  </View>
                                  <View className="flex-1 bg-red-50 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-red-500">{leave}</Text>
                                    <Text className="block text-xs text-red-400">请假</Text>
                                  </View>
                                  <View className="flex-1 bg-gray-100 rounded-xl py-2 px-3 text-center">
                                    <Text className="block text-xl font-bold text-gray-400">{unrecorded}</Text>
                                    <Text className="block text-xs text-gray-400">未记录</Text>
                                  </View>
                                </>
                              )}
                            </View>

                            {/* 分组幼儿列表 */}
                            <View className="space-y-3">
                              {groupChildren.map(child => {
                                const current = currentDisplay[child.id + '__' + child.course_type] || 'unknown'
                                return (
                                  <View key={child.id + '__' + child.course_type}>
                                    <View className="flex items-center gap-3 mb-3">
                                      <View
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                          child.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                        }`}
                                      >
                                        {child.name.charAt(0)}
                                      </View>
                                      <Text className="block text-base font-medium text-gray-900 flex-1">{child.name}</Text>
                                    </View>

                                    <View className="flex gap-2">
                                      {(child.course_type === '全日托' ? ['full_day', 'half_day', 'absent', 'leave'] : ['present', 'absent', 'leave'] as const).map(status => {
                                        const isSelected = current === status
                                        const isClickable = !isLocked
                                        return (
                                          <View
                                            key={status}
                                            className={`flex-1 py-2 rounded-xl text-center font-medium transition-all ${
                                              isSelected
                                                ? `${STATUS_CONFIG[status].color} ${STATUS_CONFIG[status].text}`
                                                : isClickable
                                                  ? 'bg-gray-100 text-gray-500 active:bg-gray-200'
                                                  : 'bg-gray-100 text-gray-300'
                                            }`}
                                            onClick={() => !isLocked && handleStatusChange(child.id + '__' + child.course_type, status)}
                                          >
                                            <Text className={`block text-sm font-medium ${
                                              isSelected
                                                ? STATUS_CONFIG[status].text
                                                : isClickable
                                                  ? 'text-gray-600'
                                                  : 'text-gray-300'
                                            }`}
                                            >
                                              {status === 'full_day' ? '✓ 全天' : status === 'half_day' ? '✓ 半天' : status === 'present' ? '✓ 到' : status === 'absent' ? '✗ 缺' : '△ 假'}
                                            </Text>
                                          </View>
                                        )
                                      })}
                                    </View>
                                  </View>
                                )
                              })}
                            </View>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </View>
            )
          })()
        )}
      </ScrollView>

      {/* 日历弹窗 */}
      <CalendarOverlay
        visible={calendarVisible}
        value={selectedDate}
        onChange={(dateStr) => {
          setSelectedDate(dateStr)
          setCalendarVisible(false)
          loadData()
        }}
        onClose={() => setCalendarVisible(false)}
        disabled={(date) => {
          const formatted = format(date, 'yyyy-MM-dd')
          return !dateList.includes(formatted)
        }}
      />

      {/* 底部操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        {selectedDate !== today ? (
          <View className="flex-1 py-3 rounded-xl text-center font-medium bg-gray-100">
            <Text className="block text-base font-medium text-gray-400">历史记录，只读查看</Text>
          </View>
        ) : isLocked ? (
          <View 
            className="flex-1 py-3 rounded-xl text-center font-medium bg-blue-500 text-white"
            onClick={handleUnlock}
          >
            <Text className="block text-base font-medium text-white">修改</Text>
          </View>
        ) : (
          <>
            <View 
              className={`flex-1 py-3 rounded-xl text-center font-medium ${
                hasUnsaved 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-400'
              }`}
              onClick={hasUnsaved ? handleSave : undefined}
            >
              <Text className={`block text-base font-medium ${hasUnsaved ? 'text-white' : 'text-gray-400'}`}>
                保存考勤 {hasUnsaved ? '' : '(无变化)'}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
