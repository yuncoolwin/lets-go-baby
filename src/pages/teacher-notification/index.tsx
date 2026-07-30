import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { notificationApi, classApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Send } from 'lucide-react-taro'

interface ClassInfo {
  id: string
  name: string
}

export default function TeacherNotificationPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'school' | 'class' | 'urgent'>('class')
  const [scope, setScope] = useState<'all' | 'classes'>('classes')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [classList, setClassList] = useState<ClassInfo[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [])

  const loadClasses = async () => {
    try {
      const res = await classApi.list({ pageSize: 100, status: 'active' })
      if (res.data?.data?.list) {
        setClassList(res.data.data.list)
        if (res.data.data.list.length > 0) {
          setSelectedClassId(res.data.data.list[0].id)
        }
      }
    } catch (err) {
      console.error('[TeacherNotification] loadClasses error:', err)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入通知标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入通知内容', icon: 'none' })
      return
    }
    if (scope === 'classes' && !selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await notificationApi.create({
        title: title.trim(),
        content: content.trim(),
        type,
        scope,
        target_ids: scope === 'classes' ? selectedClassId : undefined,
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '发布失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[TeacherNotification] submit error:', err)
      Taro.showToast({ title: '发布失败，请重试', icon: 'none' })
    }
    setSubmitting(false)
  }

  const getTypeLabel = (t: string) => {
    switch (t) {
      case 'school': return '园所通知'
      case 'class': return '班级通知'
      case 'urgent': return '紧急通知'
      default: return t
    }
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <BackButton />

      <View className="mb-4">
        <Text className="block text-lg font-bold text-foreground">发布通知</Text>
        <Text className="block text-sm text-muted-foreground mt-1">
          向家长发送班级通知
        </Text>
      </View>

      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4 space-y-4">
          {/* 通知类型 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知类型</Text>
            </Label>
            <View className="flex gap-2 mt-2">
              {(['class', 'urgent'] as const).map((t) => (
                <Badge
                  key={t}
                  className={`cursor-pointer px-3 py-1 ${
                    type === t
                      ? t === 'urgent'
                        ? 'bg-red-500 text-white'
                        : 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setType(t)}
                >
                  <Text className="text-xs">{getTypeLabel(t)}</Text>
                </Badge>
              ))}
            </View>
          </View>

          {/* 接收范围 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>接收范围</Text>
            </Label>
            <View className="flex gap-2 mt-2">
              <Badge
                className={`cursor-pointer px-3 py-1 ${
                  scope === 'classes' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => setScope('classes')}
              >
                <Text className="text-xs">指定班级</Text>
              </Badge>
              <Badge
                className={`cursor-pointer px-3 py-1 ${
                  scope === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => setScope('all')}
              >
                <Text className="text-xs">全体家长</Text>
              </Badge>
            </View>
          </View>

          {/* 班级选择 */}
          {scope === 'classes' && (
            <View>
              <Label className="text-sm text-foreground mb-2">
                <Text>选择班级</Text>
              </Label>
              <View className="flex flex-wrap gap-2 mt-2">
                {classList.map((cls) => (
                  <Badge
                    key={cls.id}
                    className={`cursor-pointer px-3 py-1 ${
                      selectedClassId === cls.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setSelectedClassId(cls.id)}
                  >
                    <Text className="text-xs">{cls.name}</Text>
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {/* 标题 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知标题 *</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入通知标题"
                value={title}
                onInput={(e) => setTitle(e.detail.value)}
              />
            </View>
          </View>

          {/* 内容 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知内容 *</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl p-4 mt-2">
              <Textarea
                className="w-full bg-transparent"
                style={{ minHeight: '120px' }}
                placeholder="请输入通知内容..."
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={500}
              />
            </View>
            <Text className="block text-xs text-muted-foreground mt-1 text-right">
              {content.length}/500
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <Button
        className="w-full bg-primary text-white rounded-xl py-3 gap-2"
        disabled={submitting}
        onClick={handleSubmit}
      >
        <Send size={18} color="#ffffff" />
        <Text>{submitting ? '发布中...' : '发布通知'}</Text>
      </Button>
    </View>
  )
}
