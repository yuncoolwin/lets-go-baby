import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react-taro'
import { classApi } from '@/utils/api'

const levelOptions = [
  { value: 'nursery', label: '托班' },
  { value: 'summer', label: '暑假班' },
  { value: 'winter', label: '寒假班' },
  { value: 'interest', label: '兴趣班' },
]

const statusOptions = [
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '停用' },
]

export default function ClassEditPage() {
  const [isEdit, setIsEdit] = useState(false)
  const [editId, setEditId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 表单字段
  const [name, setName] = useState('')
  const [level, setLevel] = useState('nursery')
  const [capacity, setCapacity] = useState('30')
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState('active')

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance?.router?.params || {}
    if (params.id) {
      setIsEdit(true)
      setEditId(params.id)
      loadClass(params.id)
      Taro.setNavigationBarTitle({ title: '编辑班级' })
    } else {
      Taro.setNavigationBarTitle({ title: '新建班级' })
    }
  }, [])

  const loadClass = async (id: string) => {
    try {
      const res = await classApi.detail(id)
      console.log('[ClassEdit] detail:', res)
      if (res.code === 200 && res.data) {
        const d = res.data
        setName(d.name || '')
        setLevel(d.level || 'nursery')
        setCapacity(String(d.capacity || 30))
        setRoom(d.room || '')
        setStatus(d.status || 'active')
      }
    } catch (err) {
      console.error('[ClassEdit] load error:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  const validate = (): boolean => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入班级名称', icon: 'none' })
      return false
    }
    const cap = parseInt(capacity, 10)
    if (Number.isNaN(cap) || cap < 1 || cap > 50) {
      Taro.showToast({ title: '容量需为1-50的整数', icon: 'none' })
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSubmitting(true)
    try {
      const data = {
        name: name.trim(),
        level,
        capacity: parseInt(capacity, 10),
        room: room.trim() || undefined,
        status,
      }

      let res
      if (isEdit) {
        res = await classApi.update(editId, data)
      } else {
        res = await classApi.create(data)
      }

      console.log('[ClassEdit] submit:', res)
      if (res.code === 200) {
        Taro.showToast({ title: isEdit ? '保存成功' : '创建成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1000)
      } else {
        Taro.showToast({ title: res.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[ClassEdit] submit error:', err)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!editId) return
    setDeleting(true)
    try {
      const res = await classApi.remove(editId)
      if (res.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 800)
      } else {
        Taro.showToast({ title: res.msg || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[ClassEdit] delete error:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
    setDeleteOpen(false)
    setDeleting(false)
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      {/* 标题栏：左标题 + 右删除（仅编辑模式） */}
      <View className="flex items-center justify-between mb-4">
        <Text className="text-lg font-bold text-foreground block">
          {isEdit ? '编辑班级' : '新建班级'}
        </Text>
        {isEdit && (
          <View
            className={`px-3 py-1 rounded-lg ${deleting ? 'bg-gray-50' : 'bg-red-50'}`}
            onClick={() => !deleting && setDeleteOpen(true)}
          >
            <Trash2 size={18} color={deleting ? '#9ca3af' : '#ef4444'} />
          </View>
        )}
      </View>
      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4 space-y-5">
          {/* 级别选择（放在最上方） */}
          <View>
            <Label className="text-sm font-medium text-foreground mb-3">
              <Text className="block">级别 *</Text>
            </Label>
            <View className="flex flex-wrap gap-2">
              {levelOptions.map((opt) => (
                <View
                  key={opt.value}
                  className={`px-4 py-2 rounded-full whitespace-nowrap ${
                    level === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setLevel(opt.value)}
                >
                  <Text className={`text-sm ${level === opt.value ? 'text-white' : ''}`}>
                    {opt.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 班级名称 */}
          <View>
            <Label className="text-sm font-medium text-foreground mb-2">
              <Text className="block">班级名称 *</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入班级名称"
                value={name}
                onInput={(e) => setName(e.detail.value)}
              />
            </View>
          </View>

          {/* 容量 */}
          <View>
            <Label className="text-sm font-medium text-foreground mb-2">
              <Text className="block">容量（1-50人）</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                type="number"
                placeholder="请输入班级容量"
                value={capacity}
                onInput={(e) => setCapacity(e.detail.value)}
              />
            </View>
          </View>

          {/* 教室位置 */}
          <View>
            <Label className="text-sm font-medium text-foreground mb-2">
              <Text className="block">教室位置</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                placeholder="如：A201"
                value={room}
                onInput={(e) => setRoom(e.detail.value)}
              />
            </View>
          </View>

          {/* 状态 */}
          <View>
            <Label className="text-sm font-medium text-foreground mb-3">
              <Text className="block">状态</Text>
            </Label>
            <View className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <View
                  key={opt.value}
                  className={`px-4 py-2 rounded-full whitespace-nowrap ${
                    status === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setStatus(opt.value)}
                >
                  <Text className={`text-sm ${status === opt.value ? 'text-white' : ''}`}>
                    {opt.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <View className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100" style={{ position: 'fixed' }}>
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          disabled={submitting}
          onClick={handleSubmit}
        >
          <Text className="text-white text-base">
            {submitting ? '提交中...' : isEdit ? '保存修改' : '创建班级'}
          </Text>
        </Button>
      </View>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除班级「{name || '未命名'}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>取消</Text>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              <Text className="text-white">删除</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
