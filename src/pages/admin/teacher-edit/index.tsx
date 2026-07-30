import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { teacherApi } from '@/utils/api'
import BackButton from '@/components/back-button'

interface Teacher {
  id: string
  real_name: string
  phone?: string
  email?: string
  qualification?: string
  specialty?: string
  class_id?: string
  class_name?: string
  status: 'active' | 'inactive'
  created_at: string
}

const STATUS_OPTIONS = [
  { label: '在职', value: 'active' },
  { label: '离职', value: 'inactive' },
]

export default function TeacherEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    title: '',
    status: 'active',
  })

  const teacherId = router.params?.id

  useEffect(() => {
    if (!teacherId) {
      Taro.showToast({ title: '参数错误', icon: 'error' })
      setTimeout(() => Taro.navigateBack(), 1500)
      return
    }
    loadTeacher()
  }, [teacherId])

  const loadTeacher = async () => {
    try {
      setLoading(true)
      const res = await teacherApi.detail(teacherId!)
      console.log('[TeacherEdit] detail response:', res)
      if (res.code === 200 && res.data) {
        const data = res.data
        setTeacher(data)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          title: data.title || '',
          status: data.status || 'active',
        })
      } else {
        Taro.showToast({ title: '教师信息不存在', icon: 'error' })
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (error) {
      console.error('[TeacherEdit] loadTeacher error:', error)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入教师姓名', icon: 'none' })
      return
    }

    try {
      setSaving(true)
      const res = await teacherApi.update(teacherId!, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        title: formData.title.trim(),
        status: formData.status,
      })
      console.log('[TeacherEdit] update response:', res)

      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'error' })
      }
    } catch (error) {
      console.error('[TeacherEdit] handleSave error:', error)
      Taro.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-muted-foreground">加载中...</Text>
      </View>
    )
  }

  if (!teacher) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-muted-foreground">教师信息不存在</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 头部 */}
      <View className="bg-white px-4 py-4 flex items-center justify-between border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">编辑教师</Text>
        <View className="w-10" />
      </View>

      {/* 表单 */}
      <View className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Label>姓名 *</Label>
              <Input
                value={formData.name}
                onInput={(e) => setFormData(prev => ({ ...prev, name: e.detail.value }))}
                placeholder="请输入教师姓名"
              />
            </View>

            <View>
              <Label>手机号</Label>
              <Input
                value={formData.phone}
                onInput={(e) => setFormData(prev => ({ ...prev, phone: e.detail.value }))}
                placeholder="请输入手机号"
                type="number"
              />
            </View>

            <View>
              <Label>职称</Label>
              <Input
                value={formData.title}
                onInput={(e) => setFormData(prev => ({ ...prev, title: e.detail.value }))}
                placeholder="请输入职称"
              />
            </View>

            <View>
              <Label>状态</Label>
              <View className="flex gap-2 mt-2">
                {STATUS_OPTIONS.map(opt => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg ${
                      formData.status === opt.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, status: opt.value }))}
                  >
                    <Text className={formData.status === opt.value ? 'text-white' : 'text-gray-600'}>
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部保存按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4">
        <Button
          className="w-full bg-primary text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </View>
    </View>
  )
}
