import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notificationApi } from '@/utils/api'
import { useDialogBack } from '@/utils/use-dialog-back'
import { useAppStore } from '@/store/app'
import { refreshUnreadBadge } from '@/utils/unread-badge'
import { Bell, Copy, Pencil, Trash2 } from 'lucide-react-taro'

interface ManageNotification {
  id: string
  title: string
  type: string
  content: string
  is_pinned?: boolean
  read_count?: number
  recipient_count?: number
  target_labels?: string[]
  created_at: string
  is_read?: boolean
  status?: string
  images?: string[]
  sender_name?: string
}

type MainTab = 'all' | 'received' | 'sent'

const typeOptions = [
  { value: '', label: '全部' },
  { value: 'all', label: '全园' },
  { value: 'course', label: '课程' },
  { value: 'class', label: '班级' },
  { value: 'personal', label: '个人' },
  { value: 'teacher', label: '教师' },
]

const typeMap: Record<string, { label: string; className: string }> = {
  all: { label: '全园', className: 'bg-red-100 text-red-700' },
  course: { label: '课程', className: 'bg-blue-100 text-blue-700' },
  class: { label: '班级', className: 'bg-green-100 text-green-700' },
  personal: { label: '个人', className: 'bg-purple-100 text-purple-700' },
  teacher: { label: '教师', className: 'bg-orange-100 text-orange-700' },
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function NotificationManagePage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const isAdmin = currentRole?.role_type === 'admin' || currentRole?.role_type === 'superadmin'

  const [mainTab, setMainTab] = useState<MainTab>('all')

  const [notifications, setNotifications] = useState<ManageNotification[]>([])
  const [receivedList, setReceivedList] = useState<ManageNotification[]>([])
  const [sentList, setSentList] = useState<ManageNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [detailItem, setDetailItem] = useState<ManageNotification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  useDialogBack(detailOpen, () => setDetailOpen(false))
  const [deleteNotifyTarget, setDeleteNotifyTarget] = useState<ManageNotification | null>(null)

  const loadAll = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true)
    try {
      const res = await notificationApi.list({
        type: typeFilter || undefined,
        page: 1,
        pageSize: 50,
      })
      console.log('[NotificationManage] list all:', res)
      if (res.code === 200 && res.data) {
        setNotifications(res.data.list || [])
      }
    } catch (err) {
      console.error('[NotificationManage] loadAll error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    if (showSkeleton) setLoading(false)
  }, [typeFilter])

  const loadReceived = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list({
        scope: 'received',
        user_role_id: currentRole?.id,
        page: 1,
        pageSize: 50,
      })
      console.log('[NotificationManage] received:', res)
      setReceivedList(res?.data?.list || [])
    } catch (err) {
      console.error('[NotificationManage] loadReceived error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [currentRole?.id])

  const loadSent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list({
        scope: 'sent',
        author_id: currentRole?.id,
        page: 1,
        pageSize: 50,
      })
      console.log('[NotificationManage] sent:', res)
      setSentList(res?.data?.list || [])
    } catch (err) {
      console.error('[NotificationManage] loadSent error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }, [currentRole?.id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleTabChange = (v: MainTab) => {
    setMainTab(v)
    if (v === 'all') loadAll()
    if (v === 'received') loadReceived()
    if (v === 'sent') loadSent()
  }

  const handleTypeChange = (type: string) => {
    setTypeFilter(type)
  }

  const handleCardClick = async (item: ManageNotification) => {
    setDetailItem(item)
    setDetailOpen(true)
    // 收到的列表：未读点击后标记已读并刷新角标
    if (mainTab === 'received' && !item.is_read && currentRole?.id) {
      try {
        await notificationApi.markRead(item.id, currentRole.id)
        setReceivedList((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        )
        setDetailItem((prev) => (prev && prev.id === item.id ? { ...prev, is_read: true } : prev))
        refreshUnreadBadge(currentRole.id)
      } catch (err) {
        console.error('[NotificationManage] markRead error:', err)
      }
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      const res = await notificationApi.revoke(id)
      if (res?.code === 200) {
        Taro.showToast({ title: '已撤回', icon: 'success' })
        loadSent()
      } else {
        Taro.showToast({ title: res?.msg || '撤回失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[NotificationManage] revoke error:', err)
      Taro.showToast({ title: '撤回失败', icon: 'none' })
    }
  }

  const handleRepublish = async (id: string) => {
    try {
      const res = await notificationApi.update(id, { status: 'published' })
      if (res?.code === 200) {
        Taro.showToast({ title: '已重新发布', icon: 'success' })
        loadSent()
      } else {
        Taro.showToast({ title: res?.msg || '发布失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[NotificationManage] republish error:', err)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    }
  }

  const handleEditSent = (id: string) => {
    Taro.navigateTo({ url: `/pages/teacher-notification/index?id=${id}` })
  }

  const handleCopyContent = (item: ManageNotification) => {
    Taro.setClipboardData({ data: item.content || '' })
    Taro.showToast({ title: '已复制', icon: 'success' })
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await notificationApi.remove(id, currentRole?.id)
      if (res?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        setDetailOpen(false)
        setDetailItem(null)
        if (mainTab === 'all') loadAll(false)
        else if (mainTab === 'received') loadReceived()
        else loadSent()
      } else {
        Taro.showToast({ title: res?.msg || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[NotificationManage] delete error:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const currentList =
    mainTab === 'all' ? notifications : mainTab === 'received' ? receivedList : sentList

  return (
    <View className="min-h-screen bg-background p-4 pb-28">
      {/* 顶部 tab */}
      <Tabs value={mainTab} onValueChange={(v) => handleTabChange(v as MainTab)}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="all">
            <Text>全部</Text>
          </TabsTrigger>
          <TabsTrigger value="received">
            <Text>收到的</Text>
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Text>发出的</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 类型筛选（仅全部 tab） */}
      {mainTab === 'all' && (
        <View className="flex gap-2 mb-4 overflow-x-auto">
          {typeOptions.map((opt) => (
            <View
              key={opt.value}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                typeFilter === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-foreground'
              }`}
              onClick={() => handleTypeChange(opt.value)}
            >
              <Text className="text-sm">{opt.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 列表 */}
      {loading ? (
        <View>
          <Skeleton className="h-24 w-full mb-3 rounded-xl" />
          <Skeleton className="h-24 w-full mb-3 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </View>
      ) : currentList.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <Bell size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">
            {mainTab === 'all' ? '暂无通知' : mainTab === 'received' ? '暂无收到的通知' : '暂无发出的通知'}
          </Text>
        </View>
      ) : (
        <View className="space-y-3">
          {currentList.map((item) => {
            const typeBadge = typeMap[item.type] || { label: item.type, className: 'bg-gray-100 text-gray-700' }
            return (
              <Card
                key={item.id}
                className="bg-white rounded-xl border-0 shadow-sm"
                onClick={mainTab === 'sent' ? undefined : () => handleCardClick(item)}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-1">
                    <View className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                      {mainTab === 'received' && !item.is_read && (
                        <View className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      )}
                      <Badge className={`${typeBadge.className} text-xs flex-shrink-0`}>
                        <Text className="text-xs">{typeBadge.label}</Text>
                      </Badge>
                      <Text className="text-base font-semibold text-foreground truncate">{item.title}</Text>
                      {(item.target_labels || []).length > 0 && (
                        <Text className="text-xs text-muted-foreground truncate">
                          {(item.target_labels || []).join('、')}
                        </Text>
                      )}
                      {mainTab === 'all' && item.is_pinned && (
                        <Badge className="bg-red-100 text-red-700 text-xs shrink-0">
                          <Text className="text-xs">置顶</Text>
                        </Badge>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatTime(item.created_at)}</Text>
                  </View>

                  {/* 全部/收到的：展示内容两行截断 */}
                  {mainTab !== 'sent' && (
                    <>
                      <Text
                        className="block text-sm text-muted-foreground"
                        style={{
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                        }}
                      >
                        {item.content}
                      </Text>
                    </>
                  )}

                  {/* 底部行：左下已读，右下发送人 */}
                  <View className="flex items-center justify-between mt-2">
                    <Text className="text-xs text-muted-foreground">
                      {mainTab !== 'received' ? `已读 ${item.read_count ?? 0}/${item.recipient_count ?? 0}` : ''}
                    </Text>
                    {item.sender_name ? (
                      <Text className="text-xs text-muted-foreground">{item.sender_name}</Text>
                    ) : null}
                  </View>

                  {/* 发出的：按 status 区分操作按钮 */}
                  {mainTab === 'sent' && item.status === 'published' && (
                    <View className="flex justify-end mt-3">
                      <Button variant="secondary" size="sm" onClick={() => handleRevoke(item.id)}>
                        <Text className="text-xs">撤回</Text>
                      </Button>
                    </View>
                  )}
                  {mainTab === 'sent' && item.status === 'revoked' && (
                    <View className="flex items-center justify-end gap-2 mt-3">
                      <Badge className="bg-gray-200 text-gray-500 text-xs">
                        <Text className="text-xs">已撤回</Text>
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => handleEditSent(item.id)}>
                        <Text className="text-xs">编辑</Text>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleRepublish(item.id)}>
                        <Text className="text-xs">再次发送</Text>
                      </Button>
                    </View>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}

      {/* 底部固定按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #f0f0f0',
          padding: '12px 16px', zIndex: 100
        }}
      >
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={() => Taro.navigateTo({ url: '/pages/teacher-notification/index' })}
        >
          <Text className="text-white">新增通知</Text>
        </Button>
      </View>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '85vh' }}>
          <DialogHeader>
            <DialogTitle>
              <View className="flex items-center gap-2 flex-wrap pr-10">
                {detailItem && (
                  <Badge className={`${typeMap[detailItem.type]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                    <Text className="text-xs">{typeMap[detailItem.type]?.label || detailItem.type}</Text>
                  </Badge>
                )}
                {detailItem?.is_pinned && (
                  <Badge className="bg-red-100 text-red-700 text-xs">
                    <Text className="text-xs">置顶</Text>
                  </Badge>
                )}
                <Text className="text-lg font-semibold text-foreground">{detailItem?.title || '通知详情'}</Text>
              </View>
            </DialogTitle>
          </DialogHeader>
          <ScrollView scrollY className="mt-4" style={{ maxHeight: '50vh' }}>
            <View className="space-y-3 pr-3">
              {detailItem && (
                <>
                  {(detailItem.target_labels || []).length > 0 && (
                    <Text className="block text-xs text-muted-foreground">
                      {(detailItem.target_labels || []).join('、')}
                    </Text>
                  )}
                  <Text className="block text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {detailItem.content}
                  </Text>
                  <View className="flex items-center justify-between">
                    <Text className="text-xs text-muted-foreground">
                      {mainTab !== 'received' ? `已读 ${detailItem.read_count ?? 0}/${detailItem.recipient_count ?? 0}` : ''}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {detailItem.sender_name ? `${detailItem.sender_name} · ` : ''}{formatTime(detailItem.created_at)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
          <View className="flex justify-end gap-2 mt-4 border-t border-gray-100 pt-4">
            <Button variant="ghost" size="sm" onClick={() => detailItem && handleCopyContent(detailItem)}>
              <Copy size={14} color="#E8651A" />
              <Text className="text-primary text-sm">复制</Text>
            </Button>
            {(mainTab === 'sent' || isAdmin) && (
              <Button variant="ghost" size="sm" onClick={() => detailItem && handleEditSent(detailItem.id)}>
                <Pencil size={14} color="#E8651A" />
                <Text className="text-primary text-sm">编辑</Text>
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => detailItem && setDeleteNotifyTarget(detailItem)}>
                <Trash2 size={14} color="#ef4444" />
                <Text className="text-red-500 text-sm">删除</Text>
              </Button>
            )}
            {mainTab === 'sent' && detailItem?.status === 'published' && (
              <Button variant="ghost" size="sm" onClick={() => detailItem && handleRevoke(detailItem.id)}>
                <Trash2 size={14} color="#ef4444" />
                <Text className="text-red-500 text-sm">撤回</Text>
              </Button>
            )}
          </View>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteNotifyTarget} onOpenChange={(open) => !open && setDeleteNotifyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该通知及其接收记录将不可恢复，确认删除？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white"
              onClick={() => {
                if (deleteNotifyTarget) {
                  handleDelete(deleteNotifyTarget.id)
                }
                setDeleteNotifyTarget(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}