import { useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { FileText } from 'lucide-react-taro'

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

const ACTION_LABELS: Record<string, string> = {
  attendance_upsert: '考勤打卡',
  attendance_clear: '清空考勤',
  course_delete: '删除课程',
  child_delete: '删除幼儿',
  role_assign: '分配角色',
  role_revoke: '撤销角色',
  user_create: '新增用户',
  user_update: '编辑用户',
  user_delete: '删除用户',
  binding_approve: '通过绑定',
  binding_reject: '拒绝绑定',
}

const TARGET_LABELS: Record<string, string> = {
  attendance: '考勤',
  course: '课程',
  child: '幼儿',
  user: '用户',
  user_role: '角色',
  binding_request: '绑定申请',
}

const FILTER_ACTIONS = ['', ...Object.keys(ACTION_LABELS)]

const PAGE_SIZE = 20

export default function AuditLogsPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)

  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const hasMoreRef = useRef(true)

  const loadLogs = useCallback(
    async (pageNum: number, filter: string, append: boolean) => {
      if (!userId) return
      try {
        const query = `operator_user_id=${userId}&page=${pageNum}&page_size=${PAGE_SIZE}${
          filter ? `&action=${filter}` : ''
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

  useDidShow(() => {
    if (currentRole?.role_type !== 'superadmin') {
      Taro.showToast({ title: '无权限', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 800)
      return
    }
    setPage(1)
    setLoading(true)
    loadLogs(1, actionFilter, false)
  })

  useReachBottom(() => {
    if (loading || loadingMore || !hasMoreRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    loadLogs(nextPage, actionFilter, true)
  })

  const handleFilterChange = (action: string) => {
    setActionFilter(action)
    setPage(1)
    setLoading(true)
    loadLogs(1, action, false)
  }

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const formatDetail = (detail: any) => {
    if (!detail) return ''
    try {
      const obj = typeof detail === 'string' ? JSON.parse(detail) : detail
      return JSON.stringify(obj)
    } catch {
      return String(detail)
    }
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="px-4 pt-4 pb-2">
        <Text className="block text-lg font-bold text-foreground">操作日志</Text>
        <Text className="block text-sm text-muted-foreground mt-1">共 {total} 条记录</Text>
      </View>

      {/* 动作类型筛选 */}
      <ScrollView scrollX className="w-full">
        <View className="flex gap-2 px-4 py-2">
          {FILTER_ACTIONS.map((a) => {
            const selected = actionFilter === a
            return (
              <View key={a || 'all'} className="shrink-0" onClick={() => handleFilterChange(a)}>
                <Badge
                  className={
                    selected
                      ? 'bg-primary text-white border-transparent'
                      : 'bg-gray-100 text-gray-600 border-transparent'
                  }
                >
                  {a ? ACTION_LABELS[a] : '全部'}
                </Badge>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* 日志列表 */}
      <View className="px-4 pb-8 pt-2">
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
                <View className="flex items-center justify-between mb-2">
                  <View className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700 border-transparent">
                      {ACTION_LABELS[log.action] || log.action || '操作'}
                    </Badge>
                    {log.target_type ? (
                      <Badge className="bg-gray-100 text-gray-600 border-transparent">
                        {TARGET_LABELS[log.target_type] || log.target_type}
                      </Badge>
                    ) : null}
                  </View>
                  {log.level === 'warn' ? (
                    <Badge className="bg-orange-100 text-orange-700 border-transparent">重要</Badge>
                  ) : null}
                </View>

                <Text className="block text-xs text-gray-400 mb-1">
                  {formatTime(log.created_at)}
                </Text>
                <Text className="block text-sm text-gray-600 mb-1">
                  操作者：{log.operator_nickname || log.user_id || '未知'}
                </Text>
                {log.detail &&
                formatDetail(log.detail) &&
                formatDetail(log.detail) !== '{}' ? (
                  <Text className="block text-xs text-gray-500 mt-1">
                    详情：{formatDetail(log.detail)}
                  </Text>
                ) : null}
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
    </View>
  )
}