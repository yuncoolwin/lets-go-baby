import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'
import { ShieldCheck, Trash2 } from 'lucide-react-taro'
import { getRelationshipLabel } from '@/utils/helpers'

interface BindingRequest {
  id: string
  parent_name: string
  child_name: string
  relationship: string
  custom_relationship?: string
  status: string
  reject_reason?: string
  created_at: string
  approved_at?: string
}

const RELATION_OPTIONS = [
  { value: 'father', label: '爸爸' },
  { value: 'mother', label: '妈妈' },
  { value: 'grandfather', label: '爷爷' },
  { value: 'grandmother', label: '奶奶' },
  { value: 'other', label: '其他' },
]

export default function ReviewPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)
  const [requests, setRequests] = useState<BindingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<BindingRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editRelationship, setEditRelationship] = useState('')
  const [editCustomRelationship, setEditCustomRelationship] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadRequests = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests',
        method: 'GET',
      })
      console.log('[Review] requests:', res.data)
      if (res.data?.data) {
        setRequests(res.data.data)
      }
    } catch (err) {
      console.error('[Review] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    if (showSkeleton) setLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleApprove = async (requestId: string) => {
    if (approvingId || rejectingId) return // 防止重复点击
    setApprovingId(requestId)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests/approve',
        method: 'POST',
        data: { request_id: requestId, operator_user_id: userId ?? undefined, operator_role_id: currentRole?.id },
      })
      // 检查响应是否成功
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已通过', icon: 'success' })
        // 静默刷新列表，不显示骨架屏
        await loadRequests(false)
        // 刷新首页红点（使用全局事件通知）
        Taro.eventCenter.trigger('refreshPendingCount')
      } else {
        Taro.showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Review] approve error:', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    if (approvingId || rejectingId) return // 防止重复点击
    setRejectingId(requestId)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests/reject',
        method: 'POST',
        data: { request_id: requestId, operator_user_id: userId ?? undefined, operator_role_id: currentRole?.id },
      })
      // 检查响应是否成功
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已拒绝', icon: 'success' })
        // 静默刷新列表，不显示骨架屏
        await loadRequests(false)
        // 刷新首页红点
        Taro.eventCenter.trigger('refreshPendingCount')
      } else {
        Taro.showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Review] reject error:', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setRejectingId(null)
    }
  }

  const getRelationLabel = (rel: string, customRel?: string) => {
    if (rel === 'guardian') return '监护人'
    if (rel === 'other' && customRel) return customRel
    return getRelationshipLabel(rel) || '其他'
  }

  const handleDelete = async (requestId: string) => {
    if (!requestId || deletingId) return
    setDeletingId(requestId)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests/delete',
        method: 'POST',
        data: { request_id: requestId },
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        await loadRequests(false)
        Taro.eventCenter.trigger('refreshPendingCount')
      } else {
        Taro.showToast({ title: res.data?.msg || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Review] delete error:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      setDeletingId(null)
    }
  }

  const openDetail = (req: BindingRequest) => {
    setDetailItem(req)
    setEditRelationship(req.relationship || '')
    setEditCustomRelationship(req.custom_relationship || '')
    setDetailOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!detailItem) return
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests/update',
        method: 'POST',
        data: {
          request_id: detailItem.id,
          relationship: editRelationship,
          custom_relationship: editRelationship === 'other' ? editCustomRelationship : '',
        },
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已保存', icon: 'success' })
        setDetailOpen(false)
        await loadRequests(false)
      } else {
        Taro.showToast({ title: res.data?.msg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Review] save edit error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      {requests.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <ShieldCheck size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无待审核申请</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {requests.map((req) => {
            const isApproving = approvingId === req.id
            const isRejecting = rejectingId === req.id
            const isProcessing = isApproving || isRejecting

            return (
              <Card key={req.id} className="bg-white rounded-xl border-0 shadow-sm" onClick={() => openDetail(req)}>
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground">{req.child_name}</Text>
                    <View className="flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                          <Text className="text-xs">待审核</Text>
                        </Badge>
                      ) : req.status === 'approved' ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Text className="text-xs">已通过</Text>
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          <Text className="text-xs">已拒绝</Text>
                        </Badge>
                      )}
                      <View
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(req.id)
                        }}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </View>
                    </View>
                  </View>
                  <View className="space-y-1 mb-3">
                    <Text className="block text-sm text-muted-foreground">
                      申请人: {req.parent_name}
                    </Text>
                    <Text className="block text-sm text-muted-foreground">
                      关系: {getRelationLabel(req.relationship, req.custom_relationship)}
                    </Text>
                    <Text className="block text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleString('zh-CN')}
                    </Text>
                    {req.reject_reason && (
                      <Text className="block text-xs text-red-500">
                        拒绝原因: {req.reject_reason}
                      </Text>
                    )}
                  </View>
                  {req.status === 'pending' && (
                    <View className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 text-white rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApprove(req.id)
                        }}
                        disabled={isProcessing}
                      >
                        <Text className="text-white text-xs">
                          {isApproving ? '处理中...' : '通过'}
                        </Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-lg border-red-200 text-red-500"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReject(req.id)
                        }}
                        disabled={isProcessing}
                      >
                        <Text className="text-xs">
                          {isRejecting ? '处理中...' : '拒绝'}
                        </Text>
                      </Button>
                    </View>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">编辑审核信息</Text>
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <View className="mt-4 space-y-4">
              <View className="space-y-2">
                <Text className="block text-sm text-foreground">关系</Text>
                <View className="flex flex-wrap gap-2">
                  {RELATION_OPTIONS.map((opt) => {
                    const active = editRelationship === opt.value
                    return (
                      <View
                        key={opt.value}
                        className={`px-4 py-2 rounded-lg ${active ? 'bg-primary' : 'bg-gray-100'}`}
                        onClick={() => {
                          setEditRelationship(opt.value)
                          if (opt.value !== 'other') setEditCustomRelationship('')
                        }}
                      >
                        <Text className={`text-sm ${active ? 'text-white' : 'text-foreground'}`}>{opt.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              {editRelationship === 'other' && (
                <View className="space-y-2">
                  <Text className="block text-sm text-foreground">自定义关系</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入自定义关系"
                      value={editCustomRelationship}
                      onInput={(e) => setEditCustomRelationship(e.detail.value)}
                    />
                  </View>
                </View>
              )}
              <Button className="w-full bg-primary text-white" onClick={handleSaveEdit}>
                保存
              </Button>
            </View>
          )}
        </DialogContent>
      </Dialog>
    </View>
  )
}
