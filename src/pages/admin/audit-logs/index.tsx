import { useState, useCallback, useRef } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { FileText, CalendarDays, ChevronDown } from 'lucide-react-taro'
import { format } from 'date-fns'

interface AuditLogItem {
  id: string
  user_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail: any
  level: string | null
  created_at: string
  operator_nickname: string
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  attendance: '考勤管理',
  class: '班级管理',
  child: '幼儿管理',
  course: '课程管理',
  holiday: '假期管理',
  notification: '通知管理',
  growth: '成长档案',
  binding_request: '绑定审核',
  user: '用户',
  user_role: '角色',
}

const ACTION_LABELS: Record<string, string> = {
  attendance_upsert: '更新了考勤',
  attendance_clear: '清除了当天考勤',
  class_create: '新增了班级「{name}」',
  class_update: '编辑了班级「{name}」',
  class_delete: '删除了班级「{name}」',
  child_create: '新增了幼儿「{name}」',
  child_update: '编辑了幼儿「{name}」',
  child_delete: '删除了幼儿「{name}」',
  course_create: '新增了课程「{name}」',
  course_update: '编辑了课程「{name}」',
  course_delete: '删除了课程「{name}」',
  holiday_create: '新增了假期「{name}」',
  holiday_update: '编辑了假期「{name}」',
  holiday_delete: '删除了假期「{name}」',
  notification_create: '发布了通知「{name}」',
  notification_update: '编辑了通知「{name}」',
  notification_delete: '删除了通知「{name}」',
  growth_create: '新增了成长档案「{name}」',
  growth_update: '编辑了成长档案「{name}」',
  growth_delete: '删除了成长档案「{name}」',
  binding_approve: '通过了绑定申请',
  binding_reject: '拒绝了绑定申请',
  user_create: '新增了用户',
  user_update: '编辑了用户',
  user_delete: '删除了用户',
  role_assign: '分配了角色',
  role_revoke: '撤销了角色',
}

const TYPE_OPTIONS = ['', ...Object.keys(TARGET_TYPE_LABELS)]

const PAGE_SIZE = 20

const buildPhrase = (action: string, detail: any) => {
  const tpl = ACTION_LABELS[action]
  if (!tpl) return action || '执行了操作'
  let name = ''
  try {
    const obj = typeof detail === 'string' ? JSON.parse(detail) : detail
    name = obj?.name || ''
  } catch {
    name = ''
  }
  if (tpl.includes('{name}')) {
    return name ? tpl.replace('{name}', `「${name}」`) : tpl.replace('「{name}」', '')
  }
  return tpl
}

export default function AuditLogsPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)

  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [logDates, setLogDates] = useState<string[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const hasMoreRef = useRef(true)

  const loadLogs = useCallback(
    async (pageNum: number, filter: string, date: string, append: boolean) => {
      if (!userId) return
      try {
        const query = `page=${pageNum}&page_size=${PAGE_SIZE}${filter ? `&target_type=${filter}` : ''}${
          date ? `&date=${date}` : ''
        }`
        const res = await Network.request({
          url: `/api/admin/audit-logs?${query}`,
          method: 'GET',
        })
        console.log('[操作日志] 请求 GET /api/admin/audit-logs', query, '->', res.data)
        if (res.data?.code === 200) {
          const list = res.data.data?.list || []
          const totalCount = res.data.data?.total || 0
          setTotal(totalCount)
          setLogs((prev) => (append ? [...prev, ...list] : list))
          hasMoreRef.current = pageNum * PAGE_SIZE < totalCount
        } else {
          Taro.showToast({ title: res.data?.msg || '加载失败', icon: 'none' })
        }
      } catch (err) {
        console.error('[操作日志] 加载失败:', err)
        Taro.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userId],
  )

  const loadLogDates = useCallback(async () => {
    if (!userId) return
    try {
      const res = await Network.request({
        url: '/api/admin/audit-logs/dates',
        method: 'GET',
      })
      console.log('[操作日志] 请求 GET /api/admin/audit-logs/dates ->', res.data)
      if (res.data?.code === 200) {
        setLogDates(res.data.data || [])
      }
    } catch (err) {
      console.warn('[操作日志] 日期列表加载失败:', err)
    }
  }, [userId])

  useDidShow(() => {
    if (currentRole?.role_type !== 'superadmin') {
      Taro.showToast({ title: '无权限', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 800)
      return
    }
    setPage(1)
    setLoading(true)
    loadLogs(1, typeFilter, selectedDate, false)
    loadLogDates()
  })

  useReachBottom(() => {
    if (loading || loadingMore || !hasMoreRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    loadLogs(nextPage, typeFilter, selectedDate, true)
  })

  const handleTypeChange = (idx: number) => {
    const next = TYPE_OPTIONS[idx] ?? ''
    setTypeFilter(next)
    setPage(1)
    setLoading(true)
    loadLogs(1, next, selectedDate, false)
  }

  const handleDateChange = (dateStr: string) => {
    setShowCalendar(false)
    if (dateStr === selectedDate) return
    setSelectedDate(dateStr)
    setPage(1)
    setLoading(true)
    loadLogs(1, typeFilter, dateStr, false)
  }

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部：日期选择器 + 记录数 */}
      <View className="flex items-center justify-between px-4 pt-3 pb-1">
        <View
          className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2"
          onClick={() => setShowCalendar(true)}
        >
          <CalendarDays size={14} color="#6b7280" />
          <Text className="block text-sm text-foreground">{selectedDate || '全部日期'}</Text>
          <ChevronDown size={13} color="#9ca3af" />
        </View>
        <Text className="block text-xs text-muted-foreground">共 {total} 条记录</Text>
      </View>

      {/* 类型筛选（下拉列表） */}
      <View className="px-4 py-2">
        <Picker
          mode="selector"
          range={TYPE_OPTIONS.map((t) => (t ? TARGET_TYPE_LABELS[t] : '全部'))}
          value={TYPE_OPTIONS.indexOf(typeFilter)}
          onChange={(e) => handleTypeChange(Number(e.detail.value))}
        >
          <View className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Text className="block text-sm text-foreground">
              {typeFilter ? TARGET_TYPE_LABELS[typeFilter] : '全部类型'}
            </Text>
            <ChevronDown size={14} color="#9ca3af" />
          </View>
        </Picker>
      </View>

      {/* 日志列表 */}
      <View className="px-4 pb-8 pt-1">
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <FileText size={48} color="#d1d5db" />
            <Text className="block text-sm text-gray-400 mt-3">暂无日志</Text>
          </View>
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="bg-white rounded-xl border-0 shadow-sm mb-3">
              <CardContent className="p-4">
                <View className="flex items-start justify-between">
                  <View className="flex flex-wrap items-center gap-1.5 flex-1 mr-2">
                    <Badge className="bg-blue-100 text-blue-700 border-transparent shrink-0">
                      {TARGET_TYPE_LABELS[log.target_type as string] || log.target_type || '其他'}
                    </Badge>
                    <Text className="text-xs text-gray-400 shrink-0">
                      {log.operator_nickname || '未知用户'}
                    </Text>
                    <Text className="text-sm text-foreground">
                      {buildPhrase(log.action, log.detail)}
                    </Text>
                  </View>
                  {log.level === 'warn' ? (
                    <Badge className="bg-orange-100 text-orange-700 border-transparent shrink-0">重要</Badge>
                  ) : null}
                </View>
                <Text className="block text-xs text-gray-400 mt-2">{formatTime(log.created_at)}</Text>
              </CardContent>
            </Card>
          ))
        )}

        {loadingMore ? (
          <View className="flex items-center justify-center py-4">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : null}
        {!loading && logs.length > 0 && !hasMoreRef.current ? (
          <View className="flex items-center justify-center py-4">
            <Text className="block text-xs text-gray-300">没有更多了</Text>
          </View>
        ) : null}
      </View>

      <CalendarOverlay
        visible={showCalendar}
        value={selectedDate}
        disabled={(date) => !logDates.includes(format(date, 'yyyy-MM-dd'))}
        onChange={handleDateChange}
        onClose={() => setShowCalendar(false)}
        showAllDates
      />
    </View>
  )
}
