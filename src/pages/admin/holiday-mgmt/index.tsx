import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'
import { Network } from '@/network'
import { classApi } from '@/utils/api'
import { Calendar, Pencil, Trash2 } from 'lucide-react-taro'

interface HolidayRecord {
  id: string
  name: string
  type: 'all' | 'class' | 'personal'
  target_id: string | null
  start_date: string
  end_date: string
  created_at: string
}

interface ClassItem {
  id: string
  name: string
}

interface ChildItem {
  id: string
  name: string
  class_id: string | null
}

const typeLabels: Record<string, { label: string; color: string }> = {
  all: { label: '全园假期', color: 'bg-purple-100 text-purple-700' },
  class: { label: '班级假期', color: 'bg-blue-100 text-blue-700' },
  personal: { label: '个人假期', color: 'bg-green-100 text-green-700' },
}

export default function HolidayManagePage() {
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [children, setChildren] = useState<ChildItem[]>([])

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<HolidayRecord | null>(null)

  // 表单字段
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'all' | 'class' | 'personal'>('all')
  const [formTargetId, setFormTargetId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [showStartCalendar, setShowStartCalendar] = useState(false)
  const [showEndCalendar, setShowEndCalendar] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/holidays', method: 'GET' })
      console.log('[假期管理] 加载数据:', res.data)
      if (res.data?.code === 200) {
        setHolidays(res.data.data || [])
      }
    } catch (err) {
      console.error('[假期管理] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClasses = useCallback(async () => {
    try {
      const res = await classApi.list()
      console.log('[假期管理] 班级列表:', res)
      if (res.code === 200) {
        setClasses(Array.isArray(res.data) ? res.data : res.data?.list || [])
      }
    } catch (err) {
      console.error('[假期管理] 加载班级失败:', err)
    }
  }, [])

  const loadChildren = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/children', method: 'GET' })
      console.log('[假期管理] 幼儿列表:', res.data)
      if (res.data?.code === 200) {
        const list = res.data.data?.list || res.data.data || []
        setChildren(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      console.error('[假期管理] 加载幼儿失败:', err)
    }
  }, [])

  useDidShow(() => {
    loadHolidays()
    loadClasses()
    loadChildren()
  })

  const openAddDialog = () => {
    setEditingHoliday(null)
    setFormName('')
    setFormType('all')
    setFormTargetId('')
    setFormStartDate('')
    setFormEndDate('')
    setDialogOpen(true)
  }

  const openEditDialog = (h: HolidayRecord) => {
    setEditingHoliday(h)
    setFormName(h.name)
    setFormType(h.type)
    setFormTargetId(h.target_id || '')
    setFormStartDate(h.start_date)
    setFormEndDate(h.end_date)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      Taro.showToast({ title: '请输入假期名称', icon: 'none' })
      return
    }
    if (!formStartDate) {
      Taro.showToast({ title: '请选择开始日期', icon: 'none' })
      return
    }
    if (!formEndDate) {
      Taro.showToast({ title: '请选择结束日期', icon: 'none' })
      return
    }
    if (formEndDate < formStartDate) {
      Taro.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }
    if (formType === 'class' && !formTargetId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' })
      return
    }
    if (formType === 'personal' && !formTargetId) {
      Taro.showToast({ title: '请选择幼儿', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const body = {
        name: formName.trim(),
        type: formType,
        target_id: formTargetId || undefined,
        start_date: formStartDate,
        end_date: formEndDate,
      }
      console.log('[假期管理] 保存表单:', body)

      let res: any
      if (editingHoliday) {
        res = await Network.request({ url: `/api/holidays/${editingHoliday.id}`, method: 'PUT', data: body })
      } else {
        res = await Network.request({ url: '/api/holidays', method: 'POST', data: body })
      }
      console.log('[假期管理] 保存结果:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: editingHoliday ? '修改成功' : '添加成功', icon: 'success' })
        setDialogOpen(false)
        loadHolidays()
      } else {
        Taro.showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[假期管理] 保存失败:', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (h: HolidayRecord) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除假期「${h.name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const delRes = await Network.request({ url: `/api/holidays/${h.id}`, method: 'DELETE' })
            console.log('[假期管理] 删除结果:', delRes.data)
            if (delRes.data?.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              loadHolidays()
            }
          } catch (err) {
            console.error('[假期管理] 删除失败:', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const getTargetName = (h: HolidayRecord): string => {
    if (h.type === 'all') return ''
    if (h.type === 'class') {
      const cls = classes.find(c => c.id === h.target_id)
      return cls?.name || '未知班级'
    }
    if (h.type === 'personal') {
      const child = children.find(c => c.id === h.target_id)
      return child?.name || '未知幼儿'
    }
    return ''
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${y}.${m}.${d}`
  }

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+08:00')
    const names = ['日', '一', '二', '三', '四', '五', '六']
    return '周' + names[d.getDay()]
  }

  const getDaysCount = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00+08:00')
    const e = new Date(end + 'T00:00:00+08:00')
    return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部操作栏 */}
      <View className="px-4 pt-4 pb-2 flex items-center justify-between">
        <Text className="block text-base font-semibold text-foreground">
          共 {holidays.length} 条假期
        </Text>
        <View className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl px-4 py-2 text-foreground"
            onClick={() => Taro.navigateTo({ url: '/pages/admin/holidays/index' })}
          >
            <Calendar size={16} className="mr-1" color="#666" />
            <Text className="text-sm">法定节假日</Text>
          </Button>
          </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-20" scrollY>
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : holidays.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Calendar size={48} color="#d1d5db" />
            <Text className="block text-sm text-gray-400 mt-3">暂无假期数据</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {holidays.map((h) => {
              const typeInfo = typeLabels[h.type] || { label: '未知', color: 'bg-gray-100 text-gray-600' }
              const targetName = getTargetName(h)
              const daysCount = getDaysCount(h.start_date, h.end_date)
              return (
                <Card key={h.id} className="bg-white rounded-xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <View className="flex items-start justify-between mb-2">
                      <View className="flex-1">
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="block text-base font-semibold text-foreground">{h.name}</Text>
                          <View className={`px-2 py-1 rounded-full text-xs ${typeInfo.color}`}>
                            <Text className="text-xs font-medium">{typeInfo.label}</Text>
                          </View>
                        </View>
                        {targetName && (
                          <Text className="block text-xs text-muted-foreground">
                            关联：{targetName}
                          </Text>
                        )}
                      </View>
                      <View className="flex items-center gap-2">
                        <View className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" onClick={() => openEditDialog(h)}>
                          <Pencil size={14} color="#666" />
                        </View>
                        <View className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center" onClick={() => handleDelete(h)}>
                          <Trash2 size={14} color="#ef4444" />
                        </View>
                      </View>
                    </View>

                    <View className="flex items-center gap-2 mt-2">
                      <Calendar size={14} color="#999" />
                      <Text className="block text-sm text-foreground">
                        {formatDate(h.start_date)} {getDayOfWeek(h.start_date)} ~ {formatDate(h.end_date)} {getDayOfWeek(h.end_date)}
                      </Text>
                    </View>
                    <Text className="block text-xs text-muted-foreground mt-1">
                      共 {daysCount} 天
                    </Text>
                  </CardContent>
                </Card>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-semibold text-foreground">
                {editingHoliday ? '编辑假期' : '新增假期'}
              </Text>
            </DialogTitle>
          </DialogHeader>

          {/* 假期名称 */}
          <View className="mb-4">
            <Text className="block text-sm font-medium text-foreground mb-2">假期名称</Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入假期名称"
                value={formName}
                onInput={(e) => setFormName(e.detail.value)}
              />
            </View>
          </View>

          {/* 假期类型 */}
          <View className="mb-4">
            <Text className="block text-sm font-medium text-foreground mb-2">假期类型</Text>
            <View className="flex gap-2">
              {(['all', 'class', 'personal'] as const).map((type) => {
                const info = typeLabels[type]
                return (
                  <View
                    key={type}
                    className={`flex-1 px-3 py-2 rounded-xl text-center text-sm ${
                      formType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => {
                      setFormType(type)
                      setFormTargetId('')
                    }}
                  >
                    <Text className="block text-sm">{info.label}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* 选择班级/幼儿 */}
          {formType === 'class' && (
            <View className="mb-4">
              <Text className="block text-sm font-medium text-foreground mb-2">选择班级</Text>
              <View className="flex flex-wrap gap-2">
                {classes.map((cls) => (
                  <View
                    key={cls.id}
                    className={`px-3 py-2 rounded-xl text-sm ${
                      formTargetId === cls.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setFormTargetId(cls.id)}
                  >
                    <Text className="block text-sm">{cls.name}</Text>
                  </View>
                ))}
                {classes.length === 0 && (
                  <Text className="block text-xs text-gray-400">暂无班级数据</Text>
                )}
              </View>
            </View>
          )}

          {formType === 'personal' && (
            <View className="mb-4">
              <Text className="block text-sm font-medium text-foreground mb-2">选择幼儿</Text>
              <View className="flex flex-wrap gap-2">
                {children.slice(0, 20).map((child) => (
                  <View
                    key={child.id}
                    className={`px-3 py-2 rounded-xl text-sm ${
                      formTargetId === child.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setFormTargetId(child.id)}
                  >
                    <Text className="block text-sm">{child.name}</Text>
                  </View>
                ))}
                {children.length === 0 && (
                  <Text className="block text-xs text-gray-400">暂无幼儿数据</Text>
                )}
              </View>
            </View>
          )}

          {/* 日期范围 */}
          <View className="mb-4">
            <Text className="block text-sm font-medium text-foreground mb-2">日期范围</Text>
            <View className="flex items-center gap-2">
              <View
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-center"
                onClick={() => setShowStartCalendar(true)}
              >
                <Text className={`block text-sm ${formStartDate ? 'text-foreground' : 'text-gray-400'}`}>
                  {formStartDate ? `${formStartDate.replace(/-/g, '/')} ${getDayOfWeek(formStartDate)}` : '开始日期'}
                </Text>
              </View>
              <Text className="block text-sm text-gray-400">~</Text>
              <View
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-center"
                onClick={() => setShowEndCalendar(true)}
              >
                <Text className={`block text-sm ${formEndDate ? 'text-foreground' : 'text-gray-400'}`}>
                  {formEndDate ? `${formEndDate.replace(/-/g, '/')} ${getDayOfWeek(formEndDate)}` : '结束日期'}
                </Text>
              </View>
            </View>
          </View>

          {/* 操作按钮 */}
          <View className="flex items-center gap-3 mt-2">
            <View className="flex-1">
              <Button className="w-full bg-gray-100 text-gray-600 rounded-xl" onClick={() => setDialogOpen(false)}>
                <Text className="block">取消</Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button className="w-full bg-primary text-primary-foreground rounded-xl" onClick={handleSave} disabled={saving}>
                <Text className="block">{saving ? '保存中...' : (editingHoliday ? '保存修改' : '添加')}</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>

      {/* 开始日期日历 */}
      <CalendarOverlay
        value={formStartDate}
        onChange={(date) => {
          setFormStartDate(date)
          if (formEndDate && date > formEndDate) {
            setFormEndDate(date)
          }
        }}
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
      />

      {/* 结束日期日历 */}
      <CalendarOverlay
        value={formEndDate}
        onChange={(date) => {
          setFormEndDate(date)
        }}
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
      />

      {/* 底部固定操作栏 */}
      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '12px 16px', zIndex: 100 }}>
        <Button className="w-full bg-primary text-primary-foreground rounded-xl py-3" onClick={openAddDialog}>
          <Text className="text-primary-foreground">新增假期</Text>
        </Button>
      </View>
    </View>
  )
}