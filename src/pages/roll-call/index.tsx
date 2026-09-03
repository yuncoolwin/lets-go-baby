import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { format } from 'date-fns'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app'
import { ChevronDown, ChevronUp } from 'lucide-react-taro'
import { Network } from '@/network'
import { dropInApi } from '@/utils/api'
import TabBar from '@/components/tab-bar'


interface ChildItem {
  id: string
  name: string
  gender: string
  class_id?: string
  birth_date?: string
  allergy?: string
  avatar_url?: string
  attendance_status?: string | null
  course_type?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  record_status?: string | null
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
  const { currentRole, userId, agentOriginalRoleType } = useAppStore()
  const isAgentAdmin = agentOriginalRoleType === 'admin'
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
  const [holidayInfo, setHolidayInfo] = useState<{ is_class_holiday: boolean; holiday_label: string | null; personal_holiday_child_ids: string[] }>({ is_class_holiday: false, holiday_label: null, personal_holiday_child_ids: [] })
  const [dropInModal, setDropInModal] = useState(false)
  const [teacherClassList, setTeacherClassList] = useState<Array<{ class_id: string; class_name: string }>>([])
  const [activeClassId, setActiveClassId] = useState('')

  // 上海时区（UTC+8）口径的当天字符串，前后端一致
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)

  useEffect(() => {
    loadData()
  }, [selectedDate, selectedClassId])

  const loadData = async () => {
    setLoading(true)
    try {
      const isAdminUser = currentRole?.role_type === 'admin' || currentRole?.role_type === 'superadmin'
      setIsAdmin(isAdminUser)

      if (isAdminUser) {
        // 管理员模式：加载所有班级列表
        const classRes = await Network.request({ url: '/api/classes' })
        const allClasses: Array<{ id: string; name: string }> = classRes.data?.data?.list || classRes.data?.data || []
        setClassList(allClasses)
        if (allClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(allClasses[0].id)
          setClassName(allClasses[0].name)
        }

        const currentClassId = selectedClassId || (allClasses.length > 0 ? allClasses[0].id : '')
        if (!currentClassId) {
          setLoading(false)
          return
        }
        setClassId(currentClassId)

        // 加载该班级该日期的假期状态（四类假期）
        await fetchHolidayStatus(currentClassId)

        // 加载日期列表
        try {
          const dateRes = await Network.request({
            url: `/api/attendance/dates/${currentClassId}`,
          })
          const dates: string[] = dateRes.data?.data || []
          const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
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
              check_in_time: s.check_in_time || null,
              check_out_time: s.check_out_time || null,
              record_status: s.status || null,
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
        // 统一锁定规则：非当天或有记录即锁定（管理员与教师一致）
        setIsLocked(selectedDate !== today || hasRecords)
        setLoading(false)
        return
      }

      // 教师模式：直接使用 grouped-overview（与教师端首页同源，支持多班）
      const teacherId = currentRole?.id
      if (!teacherId) {
        setLoading(false)
        return
      }

      const groupedRes = await Network.request({
        url: '/api/teachers/grouped-overview',
        data: { teacher_role_id: teacherId, date: selectedDate },
      })
      const groups: any[] = groupedRes.data?.data || []

      const theClassId = groups[0]?.class_id || ''
      setClassId(theClassId)
      setClassName([...new Set(groups.map(g => g.class_name).filter(Boolean))].join('、'))

      // 教师多班级：提取去重班级列表，默认选中第一个（已有选择时不覆盖）
      const uniqClasses: Array<{ class_id: string; class_name: string }> = []
      groups.forEach(g => {
        if (g.class_id && !uniqClasses.some(c => c.class_id === g.class_id)) {
          uniqClasses.push({ class_id: g.class_id, class_name: g.class_name || '' })
        }
      })
      setTeacherClassList(uniqClasses)
      setActiveClassId(prev => prev || uniqClasses[0]?.class_id || '')

      if (theClassId) {
        await fetchHolidayStatus(theClassId)
      }

      // 加载有考勤记录的日期列表
      try {
        const dateRes = await Network.request({
          url: `/api/attendance/dates/${theClassId}`,
        })
        const dates: string[] = dateRes.data?.data || []
        // 确保"今天"始终在列表中
        const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
        if (!dates.includes(todayStr)) {
          dates.unshift(todayStr)
        }
        setDateList(dates)
      } catch (e) {
        console.error('[RollCall] load dates error:', e)
      }

      // 扁平化所有分组的幼儿数据
      const allChildren: ChildItem[] = []
      const map: Record<string, AttendanceItem['status']> = {}
      groups.forEach(g => {
        (g.students || []).forEach((s: any) => {
          allChildren.push({
            id: s.id,
            name: s.name,
            gender: s.gender,
            class_id: g.class_id,
            birth_date: s.birth_date || undefined,
            course_type: g.course_type,
            attendance_status: s.attendance_status || null,
            check_in_time: s.check_in_time || null,
            check_out_time: s.check_out_time || null,
            record_status: s.attendance_status || null,
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
      // 统一锁定规则：非当天或有记录即锁定（管理员与教师一致）
      setIsLocked(selectedDate !== today || hasRecords)
    } catch (e) {
      console.error('[RollCall] load error:', e)
    }
    setLoading(false)
  }

  const fetchHolidayStatus = async (cid: string) => {
    try {
      const res = await Network.request({
        url: '/api/attendance/holiday-status',
        data: { class_id: cid, date: selectedDate },
      })
      const data = res.data?.data
      setHolidayInfo(data || { is_class_holiday: false, holiday_label: null, personal_holiday_child_ids: [] })
    } catch (e) {
      console.error('[RollCall] load holiday status error:', e)
      setHolidayInfo({ is_class_holiday: false, holiday_label: null, personal_holiday_child_ids: [] })
    }
  }

  const handleStatusChange = (childId: string, status: AttendanceItem['status']) => {
    if (isLocked) return
    const prev = tempAttendance[childId]
    if (prev === status) return
    setTempAttendance(prevAtt => ({ ...prevAtt, [childId]: status }))
    setHasUnsaved(true)
  }

  const handleCheckOut = async (child: ChildItem) => {
    const confirmRes = await Taro.showModal({
      title: '确认离园',
      confirmText: '确认离园',
    })
    if (!confirmRes.confirm) return
    try {
      await Network.request({
        url: '/api/attendance/check-out',
        method: 'POST',
        data: {
          childId: child.id,
          classId: child.class_id || classId,
          date: selectedDate,
          courseType: child.course_type || '',
        },
      })
      Taro.showToast({ title: '已离园', icon: 'success' })
      loadData()
    } catch (err) {
      console.error('[RollCall] check-out error:', err)
      Taro.showToast({ title: '离园操作失败', icon: 'none' })
    }
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
            class_id: child.class_id || classId,
            date: selectedDate,
            course_type: child.course_type,
            status,
            teacher_id: currentRole?.id || '',
            operator_user_id: userId ?? undefined,
            operator_role_id: currentRole?.id,
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
    if (selectedDate !== today) return
    if (isLocked) {
      setIsLocked(false)
      setTempAttendance(attendance)
    }
  }

  const handleClear = async () => {
    if (isLocked || selectedDate !== today) return
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
              data: { class_id: classId, date: selectedDate, operator_user_id: userId ?? undefined, operator_role_id: currentRole?.id },
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

  /** 检查某个分组是否全部已标记为出勤 */
  const isGroupAllPresent = (courseType: string, groupChildren: ChildItem[]) => {
    const expectedStatus = (courseType === '全日托' || courseType === '周六托') ? 'full_day' : 'present'
    const display = isLocked ? attendance : tempAttendance
    return groupChildren.length > 0 && groupChildren.every(child => {
      const key = child.id + '__' + child.course_type
      return (display[key] || 'unknown') === expectedStatus
    })
  }

  /** 切换全勤状态 */
  const handleToggleAllPresent = (courseType: string, groupChildren: ChildItem[]) => {
    if (isLocked) return
    const expectedStatus = (courseType === '全日托' || courseType === '周六托') ? 'full_day' : 'present'
    const isActive = isGroupAllPresent(courseType, groupChildren)

    const newTemp = { ...tempAttendance }
    groupChildren.forEach(child => {
      const key = child.id + '__' + child.course_type
      if (isActive) {
        newTemp[key] = 'unknown'
      } else {
        newTemp[key] = expectedStatus
      }
    })
    setTempAttendance(newTemp)
    setHasUnsaved(true)
  }

  const currentDisplay = isLocked ? attendance : tempAttendance

  return (
    <View className="h-full overflow-hidden bg-background" style={{ display: 'flex', flexDirection: 'column' }}>
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
        {!isAgentAdmin && selectedDate === today && (
          <View
            className="flex-1 flex justify-center"
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <Text
              className="block text-sm text-gray-600 bg-gray-100 rounded-full px-3 py-1"
              onClick={() => setDropInModal(true)}
            >
              添加临时来园
            </Text>
          </View>
        )}
        {!isAgentAdmin && (selectedDate === today || isAdmin) && (
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

      <ScrollView scrollY style={{ flex: 1, height: 0, paddingBottom: '100rpx' }}>
        {/* 教师多班级切换标签（考勤完成的班级显示绿色） */}
        {!isAdmin && teacherClassList.length > 0 && (
          <View
            className="px-4 py-2 bg-white"
            style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}
          >
            {teacherClassList.map(tc => {
              const clsChildren = children.filter(c => c.class_id === tc.class_id)
              const allRecorded = clsChildren.length > 0 && clsChildren.every(c => {
                const st = currentDisplay[c.id + '__' + c.course_type]
                return !!st && st !== 'unknown'
              })
              const isActive = activeClassId === tc.class_id
              return (
                <Text
                  key={tc.class_id}
                  className={`block text-sm rounded-full px-4 py-2 ${
                    allRecorded
                      ? isActive
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700'
                      : isActive
                        ? 'bg-[#E8651A] text-white'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setActiveClassId(tc.class_id)}
                >
                  {tc.class_name || tc.class_id}
                </Text>
              )
            })}
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
            <Text className="block text-gray-400">
              {holidayInfo.is_class_holiday ? '假期快乐！' : '暂无在读幼儿'}
            </Text>
          </View>
        ) : (
          (() => {
            // 按课程类型分组（教师多班时仅分组当前选中班级）
            const sortOrder = ['全日托', '半日托', '周六托', '晚间托', '兴趣班', '计日']
            const groupMap = new Map<string, ChildItem[]>()
            const visibleChildren = !isAdmin && activeClassId ? children.filter(c => c.class_id === activeClassId) : children
            visibleChildren.forEach(child => {
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
              <View className="px-4 pb-32 space-y-4">
                {sortedGroups.map(([courseType, groupChildren]) => {
                  const present = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'present').length
                  const absent = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'absent').length
                  const leave = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'leave').length
                  const fullDay = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'full_day').length
                  const halfDay = groupChildren.filter(c => (currentDisplay[c.id + '__' + c.course_type] || 'unknown') === 'half_day').length
                  const totalPresent = (courseType === '全日托' || courseType === '周六托') ? fullDay + halfDay : present
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
                          {/* 全勤按钮 */}
                          <View
                            onClick={(e) => {
                              e.stopPropagation?.()
                              handleToggleAllPresent(courseType, groupChildren)
                            }}
                            className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                              isGroupAllPresent(courseType, groupChildren)
                                ? 'bg-green-500 text-white border-green-500'
                                : isLocked
                                  ? 'bg-gray-100 text-gray-300 border-gray-200'
                                  : 'bg-white text-gray-500 border-gray-300 active:bg-green-50'
                            }`}
                          >
                            <Text className="block text-xs font-medium">
                              {isGroupAllPresent(courseType, groupChildren) ? '✓ 全勤' : '全勤'}
                            </Text>
                          </View>
                          {isExpanded ? (
                            <ChevronUp size={20} color="#999" />
                          ) : (
                            <ChevronDown size={20} color="#999" />
                          )}
                        </View>

                        {/* 分组统计 — 始终显示 */}
                        <View className="flex gap-2 mt-4">
                              {(courseType === '全日托' || courseType === '周六托') ? (
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

                            {/* 分组幼儿列表 — 受展开控制 */}
                            {isExpanded && (
                            <View className="space-y-3 mt-4">
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
                                      {child.check_out_time ? (
                                        <Text className="block text-xs text-gray-400 flex-shrink-0">已离园</Text>
                                      ) : !isAgentAdmin && child.check_in_time && child.record_status !== 'leave' && child.record_status !== 'absent' ? (
                                        <View
                                          className="px-2 py-1 rounded-lg bg-orange-100 flex-shrink-0"
                                          onClick={() => handleCheckOut(child)}
                                        >
                                          <Text className="block text-xs text-orange-600">离园</Text>
                                        </View>
                                      ) : null}
                                    </View>

                                    <View className="flex gap-2">
                                      {((child.course_type === '全日托' || child.course_type === '周六托') ? ['full_day', 'half_day', 'absent', 'leave'] : ['present', 'absent', 'leave'] as const).map(status => {
                                        const isSelected = current === status
                                        const isAttendanceStatus = status === 'present' || status === 'full_day' || status === 'half_day'
                                        const holidayDisabled = isAttendanceStatus && (holidayInfo.is_class_holiday || holidayInfo.personal_holiday_child_ids.includes(child.id))
                                        const isClickable = !isAgentAdmin && !isLocked && !holidayDisabled
                                        return (
                                          <View
                                            key={status}
                                            className={`flex-1 py-2 rounded-xl text-center font-medium transition-all ${
                                              isSelected && !holidayDisabled
                                                ? `${STATUS_CONFIG[status].color} ${STATUS_CONFIG[status].text}`
                                                : isClickable
                                                  ? 'bg-gray-100 text-gray-500 active:bg-gray-200'
                                                  : 'bg-gray-100 text-gray-300'
                                            }`}
                                            onClick={() => !isAgentAdmin && !isLocked && !holidayDisabled && handleStatusChange(child.id + '__' + child.course_type, status)}
                                          >
                                            <Text className={`block text-sm font-medium ${
                                              isSelected && !holidayDisabled
                                                ? STATUS_CONFIG[status].text
                                                : isClickable
                                                  ? 'text-gray-600'
                                                  : 'text-gray-300'
                                            }`}
                                            >
                                              {holidayDisabled ? '放假' : (status === 'full_day' ? '✓ 全天' : status === 'half_day' ? '✓ 半天' : status === 'present' ? '✓ 到' : status === 'absent' ? '✗ 缺' : '△ 假')}
                                            </Text>
                                          </View>
                                        )
                                      })}
                                    </View>
                                  </View>
                                )
                              })}
                            </View>
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
        disabled={isAdmin ? undefined : (date) => {
          const formatted = format(date, 'yyyy-MM-dd')
          return !dateList.includes(formatted)
        }}
      />

      {/* 底部操作栏 */}
      <View
        style={{
          position: 'fixed', left: 0, right: 0,
          bottom: 50,
          display: 'flex', flexDirection: 'row', gap: '12px',
          padding: '12px 16px', backgroundColor: '#fff',
          borderTop: '1px solid #f3f4f6', zIndex: 100,
        }}
      >
        {isAdmin ? (
          <>
            <View
              style={{ flex: 1 }}
              className={`py-3 rounded-xl text-center font-medium ${
                hasUnsaved && !isAgentAdmin
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
              onClick={isAgentAdmin ? undefined : hasUnsaved ? handleSave : undefined}
            >
              <Text className={`block text-base font-medium ${hasUnsaved && !isAgentAdmin ? 'text-white' : 'text-gray-400'}`}>
                保存考勤 {hasUnsaved && !isAgentAdmin ? '' : '(无变化)'}
              </Text>
            </View>
          </>
        ) : selectedDate !== today || isAgentAdmin ? (
          <View style={{ flex: 1 }} className="py-3 rounded-xl text-center font-medium bg-gray-100">
            <Text className="block text-base font-medium text-gray-400">{isAgentAdmin ? '管理员代理，只读查看' : '历史记录，只读查看'}</Text>
          </View>
        ) : isLocked ? (
          <View
            style={{ flex: 1 }}
            className="py-3 rounded-xl text-center font-medium bg-blue-500 text-white"
            onClick={handleUnlock}
          >
            <Text className="block text-base font-medium text-white">修改</Text>
          </View>
        ) : (
          <>
            <View
              style={{ flex: 1 }}
              className={`py-3 rounded-xl text-center font-medium ${
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
      <DropInModal
        visible={dropInModal}
        onClose={() => setDropInModal(false)}
        date={selectedDate}
        classId={classId}
        childId={currentRole?.id || ''}
        currentRole={currentRole}
        onSuccess={() => {
          Taro.showToast({ title: '已添加临时来园', icon: 'success' })
          loadData()
        }}
      />
      <TabBar />
    </View>
  )
}

// ============ 临时来园弹窗 ============

function DropInModal({
  visible,
  onClose,
  date,
  classId,
  childId,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  date: string
  classId: string
  childId: string
  currentRole?: any
  onSuccess: () => void
}) {
  const [allChildren, setAllChildren] = useState<ChildItem[]>([])
  const [pickedId, setPickedId] = useState('')
  const [searchKw, setSearchKw] = useState('')
  const [activeCourses, setActiveCourses] = useState<string[]>([])
  const [courseType, setCourseType] = useState('全日托')
  const [submitting, setSubmitting] = useState(false)
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [classList, setClassList] = useState<Array<{ id: string; name: string }>>([])
  const [pickedClassId, setPickedClassId] = useState('')

  useEffect(() => {
    if (!visible) return
    setPickedId('')
    setActiveCourses([])
    setSubmitting(false)
    ;(async () => {
      try {
        const url = '/api/children'
        const res: any = await Network.request({ url })
        const list = res.data?.data?.list || res.data?.data || []
        setAllChildren(list.map((c: any) => ({ id: c.id, name: c.name, gender: c.gender || '', class_id: c.class_id, course_type: '' })))
      } catch {
        setAllChildren([])
      }
      try {
        const wres: any = await Network.request({ url: `/api/courses?weekday=${new Date(`${date}T00:00:00`).getDay()}` })
        const clist: Array<{ id: string; name: string }> = (wres.data?.data || []).map((c: any) => ({ id: c.id, name: c.name }))
        setCourses(clist)
        setCourseType(prev => (clist.some(c => c.name === prev) ? prev : clist[0]?.name || prev))
      } catch {
        setCourses([])
      }
      try {
        const cres: any = await Network.request({ url: '/api/classes?page=1&page_size=100' })
        const cds = cres.data?.data
        const clist = (cds?.list || cds || []).map((c: any) => ({ id: c.id, name: c.name }))
        setClassList(clist)
        setPickedClassId(prev => prev || classId || clist[0]?.id || '')
      } catch {
        setClassList([])
      }
    })()
  }, [visible, date, classId])

  const handlePickChild = async (id: string) => {
    setPickedId(id)
    try {
      const res: any = await Network.request({ url: `/api/enrollments/child/${id}/active` })
      const list = res.data?.data || []
      const types: string[] = Array.isArray(list)
        ? list.map((e: any) => e.course_type).filter(Boolean)
        : []
      setActiveCourses(types)
    } catch {
      setActiveCourses([])
    }
  }

  const submit = async () => {
    if (!pickedId) {
      Taro.showToast({ title: '请选择幼儿', icon: 'none' })
      return
    }
    if (!classId) {
      Taro.showToast({ title: '缺少班级信息', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const pickedChild = allChildren.find(c => c.id === pickedId)
      const res: any = await dropInApi.add({ child_id: pickedId, class_id: pickedChild?.class_id || classId, course_type: courseType, date })
      if (res.code === 200) {
        Taro.showToast({ title: '已添加临时来园', icon: 'success' })
        onSuccess()
        onClose()
      } else {
        Taro.showToast({ title: res.msg || '添加失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <View
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <View
        className="bg-white rounded-2xl p-5"
        style={{ width: '300px', maxWidth: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text className="block text-base font-bold text-gray-900">添加临时来园</Text>
          <Text className="text-gray-400 text-lg" onClick={onClose}>×</Text>
        </View>
        <Text className="block text-xs text-gray-500 mt-1">日期：{date}</Text>

                {/* 幼儿搜索 */}
                <View className="mb-3">
                  <Input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="搜索幼儿姓名"
                    value={searchKw}
                    onInput={(e) => setSearchKw(e.detail.value)}
                  />
                </View>
        <Text className="block text-xs text-gray-500 mt-3 mb-1">选择所在班级</Text>
        <ScrollView scrollY style={{ maxHeight: '96px' }} className="border border-gray-100 rounded-lg">
          <View className="flex flex-wrap p-1" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {classList.map(cls => (
              <View
                key={cls.id}
                className={`w-[31%] m-[1%] py-2 rounded-lg text-center ${pickedClassId === cls.id ? 'bg-[#E8651A]' : 'bg-gray-100'}`}
                onClick={() => setPickedClassId(cls.id)}
              >
                <Text className={`block text-xs ${pickedClassId === cls.id ? 'text-white' : 'text-gray-700'}`}>{cls.name}</Text>
              </View>
            ))}
            {classList.length === 0 && (
              <Text className="block text-xs text-gray-400 text-center py-3 w-full">暂无班级</Text>
            )}
          </View>
        </ScrollView>

        <Text className="block text-xs text-gray-500 mt-3 mb-1">选择幼儿</Text>
        <ScrollView scrollY style={{ maxHeight: '220px' }} className="border border-gray-100 rounded-lg">
          <View className="flex flex-wrap p-1" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {allChildren.filter(c => c.name && c.name.includes(searchKw)).filter(c => c.id !== childId).filter(c => !pickedClassId || c.class_id === pickedClassId).map(c => (
              <View
                key={c.id}
                className={`w-[31%] m-[1%] py-2 rounded-lg text-center ${pickedId === c.id ? 'bg-[#E8651A]' : 'bg-gray-100'}`}
                onClick={() => handlePickChild(c.id)}
              >
                <Text className={`block text-xs ${pickedId === c.id ? 'text-white' : 'text-gray-700'}`}>{c.name}</Text>
              </View>
            ))}
            {allChildren.filter(c => c.name && c.name.includes(searchKw)).filter(c => c.id !== childId).filter(c => !pickedClassId || c.class_id === pickedClassId).length === 0 && (
              <Text className="block text-xs text-gray-400 text-center py-4 w-full">暂无可选幼儿</Text>
            )}
          </View>
        </ScrollView>

        <Text className="block text-xs text-gray-500 mt-3 mb-1">课程类型</Text>
        <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
          {courses.map(course => {
            const ct = course.name
            const disabled = activeCourses.includes(ct)
            return (
              <Text
                key={course.id}
                className={`text-xs rounded-full px-3 py-1 ${disabled ? 'bg-gray-100 text-gray-300' : courseType === ct ? 'bg-[#E8651A] text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => {
                  if (disabled) return
                  setCourseType(ct)
                }}
              >
                {ct}
              </Text>
            )
          })}
          {courses.length === 0 && (
            <Text className="block text-xs text-gray-400 py-1">当天暂无可选课程</Text>
          )}
        </View>

        <View
          className={`rounded-full py-2 mt-4 text-center ${submitting || !pickedId ? 'bg-gray-200' : 'bg-[#E8651A]'}`}
          onClick={submitting || !pickedId ? undefined : submit}
        >
          <Text className={`block text-sm font-medium ${submitting || !pickedId ? 'text-gray-400' : 'text-white'}`}>
            {submitting ? '提交中...' : '确认添加'}
          </Text>
        </View>
      </View>
    </View>
  )
}
