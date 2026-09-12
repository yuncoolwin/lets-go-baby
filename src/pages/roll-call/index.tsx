import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { format } from 'date-fns'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil } from 'lucide-react-taro'
import { Network } from '@/network'
import { dropInApi, attendanceApi, childrenApi } from '@/utils/api'
import TabBar from '@/components/tab-bar'


interface ChildItem {
  id: string
  name: string
  gender: string
  class_id?: string
  class_name?: string
  birth_date?: string
  allergy?: string
  avatar_url?: string
  attendance_status?: string | null
  course_type?: string | null
  is_drop_in?: boolean
  check_in_time?: string | null
  check_out_time?: string | null
  record_status?: string | null
}

// 课程类型排序序号（与课程管理一致，未知类型排最后）
const COURSE_TYPE_ORDER: Record<string, number> = {
  '全日托': 0,
  '半日托': 1,
  '周六托': 2,
  '晚间托': 3,
  '暑假班': 4,
  '寒假班': 5,
  '兴趣班': 6,
}

// 班级展示顺序（IC班在前、CASA班在后，未知班级排最后）
const CLASS_ORDER = ['IC班', 'CASA班']

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
  const [allPersonalHolidayIds, setAllPersonalHolidayIds] = useState<string[]>([])
  const [dropInModal, setDropInModal] = useState(false)
  const [teacherClassList, setTeacherClassList] = useState<Array<{ class_id: string; class_name: string }>>([])
  const [activeClassId, setActiveClassId] = useState('')
  const [editTimesChild, setEditTimesChild] = useState<ChildItem | null>(null)
  // 竞态保护：递增请求序号，丢弃旧日期迟到的响应
  const loadSeqRef = useRef(0)
  // 下拉刷新中
  const [refreshing, setRefreshing] = useState(false)
  // useDidShow 首次进入时跳过刷新（useEffect 已加载）
  const didShowFirstRef = useRef(true)

  // 上海时区（UTC+8）口径的当天字符串，前后端一致
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)

  useEffect(() => {
    loadData()
  }, [selectedDate, selectedClassId])

  // 前后一天切换：基于当前 selectedDate 计算，改状态由 useEffect 自动重载（竞态保护生效）
  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  // tab 切换回到考勤页时自动刷新；首次进入跳过（useEffect 已加载）
  useDidShow(() => {
    if (didShowFirstRef.current) {
      didShowFirstRef.current = false
      return
    }
    loadData()
  })

  const loadData = async () => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const isAdminUser = currentRole?.role_type === 'admin' || currentRole?.role_type === 'superadmin'
      setIsAdmin(isAdminUser)

      if (isAdminUser) {
        // 管理员模式：加载所有班级列表
        const classRes = await Network.request({ url: '/api/classes' })
        const allClasses: Array<{ id: string; name: string }> = classRes.data?.data?.list || classRes.data?.data || []
        setClassList(allClasses)

        // "全部"模式：selectedClassId 为空字符串表示查看所有班级；首屏默认选中"全部"
        const currentClassId = selectedClassId || ''

        // 加载该班级该日期的假期状态（四类假期）——单班模式才需要
        if (currentClassId) {
          await fetchHolidayStatus(currentClassId)
        }

        // 加载日期列表
        if (currentClassId) {
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
        }

        // 使用管理员专用接口查询考勤分组；全部模式不带 class_id
        const groupedRes = await Network.request({
          url: '/api/attendance/admin/overview',
          data: currentClassId ? { class_id: currentClassId, date: selectedDate } : { date: selectedDate },
        })
        const body = groupedRes.data?.data
        const groups: any[] = currentClassId ? (body || []) : (body?.groups || [])
        const allPersonalHoliday = currentClassId ? [] : (body?.all_personal_holiday_child_ids || [])
        setAllPersonalHolidayIds(allPersonalHoliday)

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
              class_name: g.class_name,
              course_type: g.course_type,
              attendance_status: s.attendance_status || null,
              check_in_time: s.check_in_time || null,
              check_out_time: s.check_out_time || null,
              record_status: s.status || null,
              is_drop_in: s.is_drop_in,
            })
            const status = s.attendance_status
            if (status === 'present' || status === 'absent' || status === 'leave' || status === 'full_day' || status === 'half_day') {
              map[s.id + '__' + g.course_type] = status
            } else {
              map[s.id + '__' + g.course_type] = 'unknown'
            }
          })
        })
        // 竞态保护：若已发起更新的请求（序号不匹配），丢弃这次迟到响应
        if (seq !== loadSeqRef.current) return
        setChildren(allChildren)
        setAttendance(map)
        setTempAttendance(map)

        const hasRecords = allChildren.some(c => {
          const s = map[c.id + '__' + c.course_type]
          return s === 'present' || s === 'absent' || s === 'leave' || s === 'full_day' || s === 'half_day'
        })
        // 锁定规则：管理员仅在有考勤记录时锁定，历史日期可编辑；教师非当天或有记录即锁定
        setIsLocked(isAdmin ? hasRecords : selectedDate !== today || hasRecords)
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
            class_name: g.class_name,
            birth_date: s.birth_date || undefined,
            course_type: g.course_type,
            attendance_status: s.attendance_status || null,
            check_in_time: s.check_in_time || null,
            check_out_time: s.check_out_time || null,
            record_status: s.attendance_status || null,
            is_drop_in: s.is_drop_in,
          })
          const status = s.attendance_status
          if (status === 'present' || status === 'absent' || status === 'leave' || status === 'full_day' || status === 'half_day') {
            map[s.id + '__' + g.course_type] = status
          } else {
            map[s.id + '__' + g.course_type] = 'unknown'
          }
        })
      })
      // 竞态保护：若已发起更新的请求（序号不匹配），丢弃这次迟到响应
      if (seq !== loadSeqRef.current) return
      setChildren(allChildren)
      setAttendance(map)
      setTempAttendance(map)

      // 如果有考勤记录，自动锁定
      const hasRecords = allChildren.some(c => {
        const s = map[c.id + '__' + c.course_type]
        return s === 'present' || s === 'absent' || s === 'leave' || s === 'full_day' || s === 'half_day'
      })
      // 锁定规则：管理员仅在有考勤记录时锁定，历史日期可编辑；教师非当天或有记录即锁定
      setIsLocked(isAdmin ? hasRecords : selectedDate !== today || hasRecords)
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
    // 点击已选中的状态按钮：取消选择，恢复未考勤（仅更新草稿，不请求后端）
    if (prev === status) {
      setTempAttendance(prevAtt => ({ ...prevAtt, [childId]: 'unknown' }))
      setHasUnsaved(true)
      return
    }
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
        // 未考勤的：若保存的考勤存在（原状态非 unknown，即取消原本考勤），则删除单条考勤记录；否则跳过
        if (status === 'unknown') {
          const savedStatus = attendance[key]
          if (savedStatus && savedStatus !== 'unknown') {
            await Network.request({
              url: '/api/attendance/remove',
              method: 'POST',
              data: {
                child_id: child.id,
                class_id: child.class_id || classId,
                date: selectedDate,
                course_type: child.course_type,
              },
            })
          }
          continue
        }
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
      loadData()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      if (!isAdmin) {
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleUnlock = () => {
    if (!isAdmin && selectedDate !== today) return
    if (isLocked) {
      setIsLocked(false)
      setTempAttendance(attendance)
    }
  }

  const handleClear = async () => {
    if (!isAdmin && selectedDate !== today) return
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
            Taro.showToast({ title: '已清除', icon: 'success' })
            loadData()
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
      {/* 头部信息：清除（左） | 日期居中 + 前后切换（中） | + 临时来园（右） */}
      <View className="bg-background px-4 py-3 border-b border-gray-100" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        {/* 左侧：清除按钮（仅非代理且当天或管理员） */}
        <View style={{ width: 56, display: 'flex', alignItems: 'center' }}>
          {!isAgentAdmin && (selectedDate === today || isAdmin) && (
            <Text className="block text-sm text-red-500" onClick={handleClear}>清除</Text>
          )}
        </View>
        {/* 中间：日期居中（左箭头 + 日期 + 右箭头） */}
        <View style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <View onClick={() => shiftDate(-1)}>
            <ChevronLeft size={20} color="#6b7280" />
          </View>
          <View onClick={() => setCalendarVisible(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <View style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
              <Text className="block text-sm text-gray-500">{selectedDate === today ? '今天' : selectedDate}</Text>
              <Text className="block text-xs text-gray-300 ml-1">▼</Text>
            </View>
            {selectedDate !== today && !isAdmin && (
              <Text className="block text-xs text-orange-500">（历史记录，只读）</Text>
            )}
          </View>
          <View onClick={() => shiftDate(1)}>
            <ChevronRight size={20} color="#6b7280" />
          </View>
        </View>
        {/* 右侧：临时来园 "+" 按钮（仅非代理且当天，管理员可历史日期） */}
        <View style={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {!isAgentAdmin && (selectedDate === today || isAdmin) && (
            <View
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setDropInModal(true)}
            >
              <Text className="block text-xl leading-none text-gray-600">+</Text>
            </View>
          )}
        </View>
      </View>

      {/* 管理员模式：班级选择器（含"全部"标签） */}
      {isAdmin && classList.length > 0 && (
        <View className="bg-background px-4 py-2 border-b border-gray-100">
          <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', overflowX: 'auto' }}>
            {/* 全部标签：selectedClassId 为空字符串表示查看全部班级 */}
            <View
              className={`px-4 py-1 rounded-full text-sm whitespace-nowrap ${
                selectedClassId === '' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => {
                if (selectedClassId !== '') {
                  setSelectedClassId('')
                  setClassName('全部班级')
                }
              }}
            >
              <Text className="block text-sm">全部</Text>
            </View>
            {classList.map(cls => {
              const isSelected = cls.id === selectedClassId
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

      <ScrollView
        scrollY
        style={{ flex: 1, height: 0, paddingBottom: '100rpx' }}
        refresherEnabled
        refresherDefaultStyle="black"
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          setRefreshing(true)
          loadData().finally(() => setRefreshing(false))
        }}
      >
        {/* 教师多班级切换标签（考勤完成的班级显示绿色） */}
        {!isAdmin && teacherClassList.length > 0 && (
          <View
            className="px-4 py-2"
            style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}
          >
            {/* 教师"全部"标签：点击查看全部班级 */}
            <Text
              className={`block text-sm rounded-full px-4 py-2 ${
                activeClassId === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => setActiveClassId('')}
            >
              全部
            </Text>
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
            const groupMap = new Map<string, ChildItem[]>()
            const visibleChildren = !isAdmin && activeClassId ? children.filter(c => c.class_id === activeClassId) : children
            visibleChildren.forEach(child => {
              const ct = child.course_type || '其他'
              if (!groupMap.has(ct)) groupMap.set(ct, [])
              groupMap.get(ct)!.push(child)
            })
            // 分组内按班级排序（IC班在前、CASA班在后、未知班级排最后），同班保持后端顺序
            groupMap.forEach(group => {
              const ci = (c: ChildItem) => CLASS_ORDER.indexOf(c.class_name || '') === -1 ? 999 : CLASS_ORDER.indexOf(c.class_name || '')
              group.sort((a, b) => ci(a) - ci(b))
              // 已保存/锁定态时，缺席与请假的幼儿整体下沉到该课程分组底部
              if (isLocked) {
                const bottom: ChildItem[] = []
                const top: ChildItem[] = []
                group.forEach(c => {
                  const st = currentDisplay[c.id + '__' + c.course_type] || 'unknown'
                  if (st === 'absent' || st === 'leave') bottom.push(c)
                  else top.push(c)
                })
                group.length = 0
                top.forEach(c => group.push(c))
                bottom.forEach(c => group.push(c))
              }
            })
            const sortedGroups = [...groupMap.entries()].sort((a, b) => {
              const ai = COURSE_TYPE_ORDER[a[0]]
              const bi = COURSE_TYPE_ORDER[b[0]]
              return (ai === undefined ? 999 : ai) - (bi === undefined ? 999 : bi)
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
                                      {(() => {
                                        // 班级圆形标签：优先展示班级简称，无班级信息则保留姓氏头像
                                        const cn = child.class_name || ''
                                        if (cn) {
                                          const short = cn.replace(/班$/, '')
                                          const clsColor = cn === 'IC班' ? 'bg-blue-100 text-blue-700' : cn === 'CASA班' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
                                          const fontSize = short.length >= 3 ? 'text-xs' : 'text-sm'
                                          return (
                                            <View className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${clsColor}`}>
                                              <Text className={`block ${fontSize}`}>{short}</Text>
                                            </View>
                                          )
                                        }
                                        return (
                                          <View className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                            child.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                          }`}
                                          >
                                            <Text className="block text-sm">{child.name.charAt(0)}</Text>
                                          </View>
                                        )
                                      })()}
                                      <View className="flex-1 flex items-center gap-2" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                        <Text className="block text-base font-medium text-gray-900 truncate">{child.name}</Text>
                                        {child.is_drop_in && <Text className="block text-xs text-orange-600">临时来园</Text>}
                                      </View>
                                      {child.check_out_time ? (
                                        <Text className="block text-xs text-gray-400 flex-shrink-0">已离园</Text>
                                      ) : !isAgentAdmin && child.check_in_time && child.record_status !== 'leave' && child.record_status !== 'absent' ? (
                                        <View
                                          className="px-3 py-2 rounded-lg bg-orange-100 flex-shrink-0"
                                          onClick={() => handleCheckOut(child)}
                                        >
                                          <Text className="block text-sm text-orange-600">离园</Text>
                                        </View>
                                      ) : null}
                                      {!isAgentAdmin && (isAdmin || selectedDate === today) && (child.check_in_time || child.check_out_time) && (
                                        <View
                                          className="p-2 rounded-full bg-gray-100 flex-shrink-0"
                                          onClick={() => setEditTimesChild(child)}
                                        >
                                          <Pencil size={13} color="#6b7280" />
                                        </View>
                                      )}
                                    </View>

                                    <View className="flex gap-2">
                                      {((child.course_type === '全日托' || child.course_type === '周六托') ? ['full_day', 'half_day', 'absent', 'leave'] : ['present', 'absent', 'leave'] as const).map(status => {
                                        const isSelected = current === status
                                        const isAttendanceStatus = status === 'present' || status === 'full_day' || status === 'half_day'
                                        // 全部模式下用合并后的 allPersonalHolidayIds，单班模式用 holidayInfo.personal_holiday_child_ids
                                        const personalHolidayIds = !selectedClassId ? (allPersonalHolidayIds || []) : holidayInfo.personal_holiday_child_ids || []
                                        const holidayDisabled = isAttendanceStatus && (holidayInfo.is_class_holiday || personalHolidayIds.includes(child.id))
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
          padding: '12px 16px', backgroundColor: '#FFF8F0',
          borderTop: '1px solid #f3f4f6', zIndex: 100,
        }}
      >
        {isAdmin && isAgentAdmin ? (
          // agent 代理管理员：只读灰态
          <View style={{ flex: 1 }} className="py-3 rounded-xl text-center font-medium bg-gray-100">
            <Text className="block text-base font-medium text-gray-400">管理员代理，只读查看</Text>
          </View>
        ) : isAdmin ? (
          isLocked ? (
            // 有考勤记录：显示修改按钮（管理员可对任意日期解锁修改）
            <View
              style={{ flex: 1 }}
              className="py-3 rounded-xl text-center font-medium bg-blue-500 text-white"
              onClick={handleUnlock}
            >
              <Text className="block text-base font-medium text-white">修改</Text>
            </View>
          ) : (
            // 无记录：显示保存考勤按钮
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
          )
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
      <TimeEditModal
        visible={!!editTimesChild}
        child={editTimesChild}
        date={selectedDate}
        classId={editTimesChild?.class_id || classId}
        onClose={() => setEditTimesChild(null)}
        onSuccess={() => {
          Taro.showToast({ title: '已保存', icon: 'success' })
          setEditTimesChild(null)
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
  const [isNewChild, setIsNewChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildGender, setNewChildGender] = useState('male')
  const [newChildBirthDate, setNewChildBirthDate] = useState('')
  const [newChildPhone, setNewChildPhone] = useState('')
  const [showBirthCalendar, setShowBirthCalendar] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPickedId('')
    setActiveCourses([])
    setSubmitting(false)
    setIsNewChild(false)
    setNewChildName('')
    setNewChildGender('male')
    setNewChildBirthDate('')
    setNewChildPhone('')
    setShowBirthCalendar(false)
    ;(async () => {
      try {
        const url = '/api/children?page=1&page_size=1000'
        const res: any = await Network.request({ url })
        const list = res.data?.data?.list || res.data?.data || []
        setAllChildren(list.map((c: any) => ({ id: c.id, name: c.name, gender: c.gender || '', class_id: c.class_id, course_type: '' })))
      } catch {
        setAllChildren([])
      }
      try {
        // 计算课程筛选 weekday：补班周六/补班周日（调休上班）按工作日处理，传工作日 weekday（1-5）
        let weekday = new Date(`${date}T00:00:00`).getDay()
        if (weekday === 6 || weekday === 0) {
          try {
            const wwRes: any = await Network.request({ url: `/api/attendance/work-weekend?date=${date}` })
            if (wwRes.data?.data?.workWeekend) weekday = 5
          } catch {
            // 接口异常时保持默认周六筛选
          }
        }
        const wres: any = await Network.request({ url: `/api/courses?weekday=${weekday}` })
        const COURSE_ORDER = ['全日托', '半日托', '周六托', '晚间托', '暑假班', '寒假班', '兴趣班']
        const sortIdx = (n: string) => { const i = COURSE_ORDER.indexOf(n); return i === -1 ? COURSE_ORDER.length : i }
        const clist: Array<{ id: string; name: string }> = ((wres.data?.data || []) as any[])
          .filter((c: any) => c.status !== '停用')
          .sort((a: any, b: any) => sortIdx(a.name) - sortIdx(b.name))
          .map((c: any) => ({ id: c.id, name: c.name }))
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
    if (isNewChild) {
      const name = newChildName.trim()
      if (!name) {
        Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
        return
      }
      if (!newChildBirthDate) {
        Taro.showToast({ title: '请选择出生日期', icon: 'none' })
        return
      }
      if (!pickedClassId) {
        Taro.showToast({ title: '缺少班级信息', icon: 'none' })
        return
      }
      setSubmitting(true)
      try {
        // 第一步：正式建档（性别默认男、家长电话选填）
        const createRes: any = await childrenApi.create({
          name,
          gender: newChildGender,
          birth_date: newChildBirthDate,
          class_id: pickedClassId,
          parent_phone: newChildPhone.trim() || undefined,
          status: 'active',
        })
        if (createRes.code !== 200) {
          Taro.showToast({ title: createRes.msg || '建档失败', icon: 'none' })
          return
        }
        const newChildId = createRes.data?.id
        if (!newChildId) {
          Taro.showToast({ title: '建档失败', icon: 'none' })
          return
        }
        // 第二步：写入当天临时来园记录
        const res: any = await dropInApi.add({ child_id: newChildId, class_id: pickedClassId, course_type: courseType, date })
        if (res.code === 200) {
          Taro.showToast({ title: '已添加临时来园', icon: 'success' })
          onSuccess()
          onClose()
        } else {
          Taro.showToast({ title: '临时来园添加失败', icon: 'none' })
        }
      } catch {
        Taro.showToast({ title: '添加失败', icon: 'none' })
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (!pickedId) {
      Taro.showToast({ title: '请选择幼儿', icon: 'none' })
      return
    }
    if (!pickedClassId) {
      Taro.showToast({ title: '缺少班级信息', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const res: any = await dropInApi.add({ child_id: pickedId, class_id: pickedClassId, course_type: courseType, date })
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
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <Text className="block text-base font-bold text-gray-900">添加临时来园</Text>
            <Text className="block text-xs text-gray-500">{date}</Text>
          </View>
          <Text className="text-gray-400 text-lg" onClick={onClose}>×</Text>
        </View>

                {/* 新增入口：切换新幼儿建档 */}
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }} className="mb-2">
                  <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <Text
                      className={`text-xs rounded-full px-3 py-1 ${!isNewChild ? 'bg-[#E8651A] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setIsNewChild(false)}
                    >
                      已有幼儿
                    </Text>
                    <Text
                      className={`text-xs rounded-full px-3 py-1 ${isNewChild ? 'bg-[#E8651A] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setIsNewChild(true)}
                    >
                      新幼儿建档
                    </Text>
                  </View>
                </View>

        {!isNewChild ? (
        <>
        <View className="mb-3">
          <Input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="搜索幼儿姓名"
            value={searchKw}
            onInput={(e) => setSearchKw(e.detail.value)}
          />
        </View>
        <ScrollView scrollY style={{ maxHeight: '220px' }} className="border border-gray-100 rounded-lg">
          <View className="flex flex-wrap p-1" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {allChildren.filter(c => c.name && c.name.includes(searchKw)).filter(c => c.id !== childId).map(c => (
              <View
                key={c.id}
                className={`w-[31%] m-[1%] py-2 rounded-lg text-center ${pickedId === c.id ? 'bg-[#E8651A]' : 'bg-gray-100'}`}
                onClick={() => handlePickChild(c.id)}
              >
                <Text className={`block text-xs ${pickedId === c.id ? 'text-white' : 'text-gray-700'}`}>{c.name}</Text>
              </View>
            ))}
            {allChildren.filter(c => c.name && c.name.includes(searchKw)).filter(c => c.id !== childId).length === 0 && (
              <Text className="block text-xs text-gray-400 text-center py-4 w-full">暂无可选幼儿</Text>
            )}
          </View>
        </ScrollView>
        </>
        ) : (
        <>
        <Text className="block text-xs text-gray-500 mt-3 mb-1">输入新幼儿姓名</Text>
        <View className="border border-gray-200 rounded-lg px-3 py-2">
          <Input
            className="text-sm bg-transparent"
            style={{ width: '100%' }}
            placeholder="请输入姓名"
            value={newChildName}
            onInput={(e) => setNewChildName(e.detail.value)}
          />
        </View>
        <Text className="block text-xs text-gray-500 mt-3 mb-1">性别</Text>
        <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
          {[['male', '男'], ['female', '女']].map(([val, label]) => (
            <View
              key={val}
              className={`px-4 py-2 rounded-lg ${newChildGender === val ? 'bg-[#E8651A]' : 'bg-gray-100'}`}
              onClick={() => setNewChildGender(val)}
            >
              <Text className={`block text-sm ${newChildGender === val ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
            </View>
          ))}
        </View>
        <Text className="block text-xs text-gray-500 mt-3 mb-1">出生日期</Text>
        <View className="border border-gray-200 rounded-lg px-3 py-2" onClick={() => setShowBirthCalendar(true)}>
          <Text className={`block text-sm ${newChildBirthDate ? 'text-gray-900' : 'text-gray-400'}`}>
            {newChildBirthDate || '请选择出生日期'}
          </Text>
        </View>
        <CalendarOverlay
          visible={showBirthCalendar}
          onClose={() => setShowBirthCalendar(false)}
          value={newChildBirthDate}
          onChange={(d) => { setNewChildBirthDate(d); setShowBirthCalendar(false) }}
        />
        <Text className="block text-xs text-gray-500 mt-3 mb-1">家长电话</Text>
        <View className="border border-gray-200 rounded-lg px-3 py-2">
          <Input
            className="text-sm bg-transparent"
            style={{ width: '100%' }}
            type="number"
            placeholder="请输入家长电话（选填）"
            value={newChildPhone}
            onInput={(e) => setNewChildPhone(e.detail.value)}
          />
        </View>
        </>
        )}

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
          className={`rounded-full py-2 mt-4 text-center ${submitting || (isNewChild ? !newChildName.trim() || !newChildBirthDate : !pickedId) ? 'bg-gray-200' : 'bg-[#E8651A]'}`}
          onClick={submitting || (isNewChild ? !newChildName.trim() || !newChildBirthDate : !pickedId) ? undefined : submit}
        >
          <Text className={`block text-sm font-medium ${submitting || (isNewChild ? !newChildName.trim() || !newChildBirthDate : !pickedId) ? 'text-gray-400' : 'text-white'}`}>
            {submitting ? '提交中...' : '确认添加'}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ============ 入园/离园时间编辑弹窗 ============

/** 将 "2026-09-09T16:56:00+08:00" 还原为 "HH:mm"，空/非法返回空字符串 */
function toHm(iso?: string | null): string {
  if (!iso) return ''
  const m = String(iso).match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}

function TimeEditModal({
  visible,
  child,
  date,
  classId,
  onClose,
  onSuccess,
}: {
  visible: boolean
  child: ChildItem | null
  date: string
  classId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [inTime, setInTime] = useState('')
  const [outTime, setOutTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible || !child) return
    // 直接还原成已记录的时间，无记录时不自动填充当前时间，保证清空后重新打开仍为空
    setInTime(toHm(child.check_in_time))
    setOutTime(toHm(child.check_out_time))
    setSubmitting(false)
  }, [visible, child])

  if (!visible || !child) return null

  const hasAnyTime = !!inTime || !!outTime

  const handleClear = () => {
    setInTime('')
    setOutTime('')
  }

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const res: any = await attendanceApi.updateRecordTimes({
        child_id: child.id,
        class_id: classId,
        date,
        course_type: child.course_type || '',
        check_in_time: inTime || '',
        // 未设置离园时间则清空（未离园）
        check_out_time: outTime || '',
      })
      if (res.code === 200) {
        onSuccess()
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'none' })
        setSubmitting(false)
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
      setSubmitting(false)
    }
  }

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
          <Text className="block text-base font-bold text-gray-900">编辑接送时间</Text>
          <Text className="text-gray-400 text-lg" onClick={onClose}>×</Text>
        </View>

        <Text className="block text-sm text-gray-700 mt-1">{child.name} · {child.course_type || '未分课程'}</Text>
        <Text className="block text-xs text-gray-400 mt-1">{date}</Text>

        {/* 入园时间 */}
        <Text className="block text-xs text-gray-500 mt-4 mb-1">入园时间</Text>
        <Picker
          mode="time"
          value={inTime || '12:00'}
          onChange={(e) => setInTime(e.detail.value)}
        >
          <View className="border border-gray-200 rounded-lg px-3 py-2">
            <Text className={`block text-sm ${inTime ? 'text-gray-900' : 'text-gray-400'}`}>{inTime || '请选择入园时间'}</Text>
          </View>
        </Picker>

        {/* 离园时间 */}
        <Text className="block text-xs text-gray-500 mt-3 mb-1">离园时间（可清空表示未离园）</Text>
        <Picker
          mode="time"
          value={outTime || inTime || '12:00'}
          onChange={(e) => setOutTime(e.detail.value)}
        >
          <View className="border border-gray-200 rounded-lg px-3 py-2">
            <Text className={`block text-sm ${outTime ? 'text-gray-900' : 'text-gray-400'}`}>{outTime ? `${outTime}（已离园）` : '未离园，可点击设置'}</Text>
          </View>
        </Picker>

        {hasAnyTime && (
          <Text
            className="block text-xs text-red-500 mt-2 text-right"
            onClick={handleClear}
          >
            清空入园离园时间
          </Text>
        )}

        <View
          className={`rounded-full py-2 mt-4 text-center ${submitting ? 'bg-gray-200' : 'bg-[#E8651A]'}`}
          onClick={submitting ? undefined : handleSave}
        >
          <Text className={`block text-sm font-medium ${submitting ? 'text-gray-400' : 'text-white'}`}>
            {submitting ? '保存中...' : '确认保存'}
          </Text>
        </View>
      </View>
    </View>
  )
}
