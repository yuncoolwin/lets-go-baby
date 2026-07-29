import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notificationApi } from '@/utils/api'
import { useAppStore } from '@/store/app'

const typeOptions = [
  { value: 'school', label: '园所通知' },
  { value: 'class', label: '班级通知' },
  { value: 'urgent', label: '紧急通知' },
]

const scopeOptions = [
  { value: 'all', label: '全体' },
  { value: 'classes', label: '按班级' },
  { value: 'specific', label: '指定人员' },
]

export default function NotificationEditPage() {
  const { userId } = useAppStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('school')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState('all')
  const [isPinned, setIsPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入通知标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入通知内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await notificationApi.create({
        title: title.trim(),
        content: content.trim(),
        type,
        scope,
        is_pinned: isPinned,
        author_id: userId,
      })
      console.log('[NotificationEdit] create:', res)

      if (res.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack()
          } else {
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }, 1500)
      } else {
        Taro.showToast({ title: res.msg || '发布失败', icon: 'none' })
        setSubmitting(false)
      }
    } catch (err) {
      console.error('[NotificationEdit] error:', err)
      Taro.showToast({ title: '发布失败', icon: 'none' })
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4 space-y-4">
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

          {/* 通知类型 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>通知类型</Text>
            </Label>
            <View className="flex gap-2 mt-2">
              {typeOptions.map((opt) => (
                <View
                  key={opt.value}
                  className={`px-4 py-2 rounded-full text-sm ${
                    type === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-foreground'
                  }`}
                  onClick={() => setType(opt.value)}
                >
                  <Text className="text-sm">{opt.label}</Text>
                </View>
              ))}
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
                placeholder="请输入通知内容"
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={500}
              />
            </View>
            <Text className="block text-xs text-muted-foreground mt-1 text-right">
              {content.length}/500
            </Text>
          </View>

          {/* 接收范围 */}
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>接收范围</Text>
            </Label>
            <View className="flex gap-2 mt-2">
              {scopeOptions.map((opt) => (
                <View
                  key={opt.value}
                  className={`px-4 py-2 rounded-full text-sm ${
                    scope === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-foreground'
                  }`}
                  onClick={() => setScope(opt.value)}
                >
                  <Text className="text-sm">{opt.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 是否置顶 */}
          <View className="flex items-center justify-between">
            <Label className="text-sm text-foreground">
              <Text>置顶显示</Text>
            </Label>
            <Switch
              checked={isPinned}
              onCheckedChange={(checked) => setIsPinned(checked)}
            />
          </View>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <Button
        className="w-full bg-primary text-white rounded-xl py-3"
        disabled={submitting}
        onClick={handleSubmit}
      >
        <Text>{submitting ? '发布中...' : '发布通知'}</Text>
      </Button>
    </View>
  )
}
