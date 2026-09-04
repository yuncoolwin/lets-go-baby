import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'
import { ShieldCheck, Trash2 } from 'lucide-react-taro'
import { formatChineseDateTime, getRelationshipLabel } from '@/utils/helpers'
import { useDialogBack } from '@/utils/use-dialog-back'

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
  request_nickname?: string
  request_gender?: string
  request_birth_date?: string
  request_allergies?: string
  request_parent_phone?: string
  child_nickname?: string
  child_gender?: string
  child_birth_date?: string
  child_allergies?: string
  child_parent_phone?: string
}

const RELATION_OPTIONS = [
  { value: 'father', label: '爸爸' },
  { value: 'mother', label: '妈妈' },
  { value: 'grandfather', label: '爷爷' },
  { value: 'grandmother', label: '奶奶' },
  { value: 'other', label: '其他' },
]

// 资料逐项审核：勾选要采纳的项（key 为字段英文名，req/cur 为申请值与当前值）
const REVIEW_FIELDS: Array<{ key: string; label: string; reqKey: keyof BindingRequest; curKey: keyof BindingRequest }> = [
  { key: 'nickname', label: '昵称', reqKey: 'request_nickname', curKey: 'child_nickname' },
  { key: 'gender', label: '性别', reqKey: 'request_gender', curKey: 'child_gender' },
  { key: 'birth_date', label: '出生日期', reqKey: 'request_birth_date', curKey: 'child_birth_date' },
  { key: 'allergies', label: '过敏状况', reqKey: 'request_allergies', curKey: 'child_allergies' },
  { key: 'parent_phone', label: '家长电话', reqKey: 'request_parent_phone', curKey: 'child_parent_phone' },
]

const GENDER_TEXT: Record<string, string> = { male: '男', female: '女' }

export default function ReviewPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)
  const isSuperadmin = currentRole?.role_type === 'superadmin'
  const [requests, setRequests] = useState<BindingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [approvedFields, setApprovedFields] = useState<string[]>([])
  const [detailItem, setDetailItem] = useState<BindingRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  useDialogBack(detailOpen, () => setDetailOpen(false))
  const [editRelationship, setEditRelationship] = useState('')
  const [editCustomRelationship, setEditCustomRelationship] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BindingRequest | null>(null)

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

  const handleApprove = async (requestId: string, fields: string[] = []) => {
    if (approvingId || rejectingId) return // 防止重复点击
    setApprovingId(requestId)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests/approve',
        method: 'POST',
        data: { request_id: requestId, approved_fields: fields, operator_user_id: userId ?? undefined, operator_role_id: currentRole?.id },
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
        data: { request_id: requestId, operator_role_id: currentRole?.id },
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
    setApprovedFields([])
    setEditRelationship(req.relationship || '')
    setEditCustomRelationship(req.custom_relationship || '')
    setEditStatus(req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : '')
    setDetailOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!detailItem || saving) return
    const targetStatus = editStatus
    setSaving(true)
    try {
      // 1. 保存关系
      const saveRes = await Network.request({
        url: '/api/admin/binding-requests/update',
        method: 'POST',
        data: {
          request_id: detailItem.id,
          relationship: editRelationship,
          custom_relationship: editRelationship === 'other' ? editCustomRelationship : '',
        },
      })
      if (saveRes.data?.code !== 200) {
        Taro.showToast({ title: saveRes.data?.msg || '保存关系失败', icon: 'none' })
        return
      }
      // 2. 状态切换（仅 approved/rejected 且目标状态发生变化时）
      if (targetStatus && targetStatus !== detailItem.status) {
        const statusRes = await Network.request({
          url: '/api/admin/binding-requests/set-status',
          method: 'POST',
          data: {
            request_id: detailItem.id,
            status: targetStatus,
            operator_user_id: userId ?? undefined,
          },
        })
        if (statusRes.data?.code !== 200) {
          Taro.showToast({ title: statusRes.data?.msg || '状态更新失败', icon: 'none' })
          return
        }
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setDetailOpen(false)
      setSaveConfirmOpen(false)
      await loadRequests(false)
      if (targetStatus && targetStatus !== detailItem.status) {
        Taro.eventCenter.trigger('refreshPendingCount')
      }
    } catch (err) {
      console.error('[Review] confirm save error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
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
                      {isSuperadmin && (
                        <View
                          className="w-8 h-8 flex items-center justify-center rounded-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(req)
                          }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </View>
                      )}
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
                      {formatChineseDateTime(new Date(req.created_at))}
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
              {detailItem.status === 'pending' && (
                <View className="space-y-2">
                  <Text className="block text-sm text-foreground">资料逐项审核（勾选要采纳的项）</Text>
                  {REVIEW_FIELDS.map((f) => {
                    const checked = approvedFields.includes(f.key)
                    const reqVal = detailItem[f.reqKey]
                    const curVal = detailItem[f.curKey]
                    const display = (v: unknown) => {
                      if (f.key === 'gender') return GENDER_TEXT[String(v || '')] || '未填写'
                      return v ? String(v) : '未填写'
                    }
                    return (
                      <View
                        key={f.key}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border ${checked ? 'border-[#E8651A] bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                        onClick={() => {
                          setApprovedFields((prev) => (checked ? prev.filter((k) => k !== f.key) : [...prev, f.key]))
                        }}
                      >
                        <View className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <Text className="text-sm text-foreground flex-shrink-0">{f.label}</Text>
                          <Text className="text-xs text-gray-500 truncate flex-1">
                            {display(reqVal)} → {display(curVal)}
                          </Text>
                        </View>
                        <View className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                          <Text className={`text-xs leading-none ${checked ? 'text-white' : 'text-transparent'}`}>✓</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
              {detailItem.status !== 'pending' && (
                <View className="space-y-2">
                  <Text className="block text-sm text-foreground">审核状态</Text>
                  <View className="flex flex-wrap gap-2">
                    {[
                      { value: 'approved', label: '通过' },
                      { value: 'rejected', label: '拒绝' },
                    ].map((opt) => {
                      const active = editStatus === opt.value
                      return (
                        <View
                          key={opt.value}
                          className={`px-4 py-2 rounded-lg ${active ? 'bg-primary' : 'bg-gray-100'}`}
                          onClick={() => setEditStatus(opt.value)}
                        >
                          <Text className={`text-sm ${active ? 'text-white' : 'text-foreground'}`}>{opt.label}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}
              {detailItem.status === 'pending' && (
                <Button
                  className="w-full bg-green-500 text-white"
                  disabled={approvingId === detailItem.id}
                  onClick={() => {
                    handleApprove(detailItem.id, approvedFields).then(() => setDetailOpen(false))
                  }}
                >
                  <Text className="text-white">
                    {approvingId === detailItem.id ? '处理中...' : '通过'}
                  </Text>
                </Button>
              )}
              <Button className="w-full bg-primary text-white" disabled={saving} onClick={() => setSaveConfirmOpen(true)}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </View>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存</AlertDialogTitle>
            <AlertDialogDescription>
              将保存关系与状态变更，确认提交？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>确认保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              仅删除审核申请记录，不影响已绑定的家长绑定关系。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id)
                }
                setDeleteTarget(null)
              }}
            >
              {deletingId ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
