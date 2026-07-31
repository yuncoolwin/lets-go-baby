import { useState, useEffect } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { notificationApi, classApi, childrenApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Send, Users, User } from 'lucide-react-taro'

interface ClassInfo {
  id: string
  name: string
}

interface ChildInfo {
  id: string
  name: string
  class_id: string
  class_name: string
  status: string
  parent_id?: string
}

const TYPE_OPTIONS = [
  { value: 'class', label: '班级通知' },
  { value: 'personal', label: '个人通知' },
] as const

export default function TeacherNotificationPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'class' | 'personal'>('class')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [classList, setClassList] = useState<ClassInfo[]>([])
  const [childrenList, setChildrenList] = useState<ChildInfo[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadClasses()
    loadChildren()
  }, [])

  const loadClasses = async () => {
    try {
      const res = await classApi.list({ pageSize: 100 })
      console.log('[TeacherNotification] loadClasses response:', res.data)
      const responseData = res.data as any
      if (responseData?.code === 200) {
        const list = responseData?.data?.list || responseData?.list || []
        setClassList(list)
        console.log('[TeacherNotification] setClassList:', list)
      }
    } catch (err) {
      console.error('[TeacherNotification] loadClasses error:', err)
    }
  }

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      console.log('[TeacherNotification] loadChildren response:', res.data)
      if (res.data?.data?.list) {
        setChildrenList(res.data.data.list)
      }
    } catch (err) {
      console.error('[TeacherNotification] loadChildren error:', err)
    }
  }

  const handleClassToggle = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
    // 切换班级时清空已选幼儿
    setSelectedChildId('')
  }

  // 个人通知：根据选中的班级筛选在读幼儿
  const filteredChildren = type === 'personal'
    ? (selectedClassIds.length > 0
        ? childrenList.filter(c => selectedClassIds.includes(c.class_id))
        : childrenList)
    : []

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入通知标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入通知内容', icon: 'none' })
      return
    }
    if (type === 'class' && selectedClassIds.length === 0) {
      Taro.showToast({ title: '请选择至少一个班级', icon: 'none' })
      return
    }
    if (type === 'personal' && !selectedChildId) {
      Taro.showToast({ title: '请选择通知对象', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      let targetIds = ''
      let scope = 'classes'
      if (type === 'class') {
        targetIds = selectedClassIds.join(',')
        scope = 'classes'
      } else {
        // 个人通知：发送给对应家长
        targetIds = selectedChildId
        scope = 'personal'
      }

      const res = await notificationApi.create({
        title: title.trim(),
        content: content.trim(),
        type: type === 'class' ? 'class' : 'urgent',
        scope,
        target_ids: targetIds,
      })

      console.log('[TeacherNotification] submit response:', res.data)
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

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      <BackButton />

      <View className="mb-4">
        <Text className="block text-lg font-bold text-foreground">发布通知</Text>
        <Text className="block text-sm text-muted-foreground mt-1">
          向家长发送通知
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
              {TYPE_OPTIONS.map((opt) => (
                <View
                  key={opt.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                    type === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => {
                    setType(opt.value)
                    setSelectedChildId('')
                  }}
                >
                  {opt.value === 'class' ? (
                    <Users size={14} color={type === opt.value ? '#ffffff' : '#666666'} />
                  ) : (
                    <User size={14} color={type === opt.value ? '#ffffff' : '#666666'} />
                  )}
                  <Text className={`text-sm ${type === opt.value ? 'text-white' : 'text-gray-600'}`}>
                    {opt.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 班级通知 — 选择班级 */}
          {type === 'class' && (
            <View>
              <Label className="text-sm text-foreground mb-2">
                <Text>选择班级</Text>
              </Label>
              <View className="flex flex-wrap gap-2 mt-2">
                {classList.length > 0 ? classList.map((cls) => (
                  <Badge
                    key={cls.id}
                    className={`cursor-pointer px-4 py-2 ${
                      selectedClassIds.includes(cls.id)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => handleClassToggle(cls.id)}
                  >
                    <Text className="text-sm">{cls.name}</Text>
                  </Badge>
                )) : (
                  <Text className="block text-sm text-muted-foreground">暂无班级</Text>
                )}
              </View>
            </View>
          )}

          {/* 个人通知 — 先选班级筛选，再选幼儿 */}
          {type === 'personal' && (
            <>
              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>按班级筛选</Text>
                </Label>
                <View className="flex flex-wrap gap-2 mt-2">
                  {classList.length > 0 ? classList.map((cls) => (
                    <Badge
                      key={cls.id}
                      className={`cursor-pointer px-4 py-2 ${
                        selectedClassIds.includes(cls.id)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => handleClassToggle(cls.id)}
                    >
                      <Text className="text-sm">{cls.name}</Text>
                    </Badge>
                  )) : (
                    <Text className="block text-sm text-muted-foreground">暂无班级</Text>
                  )}
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>选择幼儿（通知其家长）</Text>
                </Label>
                {filteredChildren.length > 0 ? (
                  <Picker
                    mode="selector"
                    range={filteredChildren.map(c => {
                      const cls = classList.find(cl => cl.id === c.class_id)
                      return `${c.name}（${cls?.name || c.class_name || '未知班级'}）`
                    })}
                    onChange={(e) => {
                      const idx = Number(e.detail.value)
                      if (idx >= 0 && idx < filteredChildren.length) {
                        setSelectedChildId(filteredChildren[idx].id)
                      }
                    }}
                  >
                    <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                      <Text className={`text-sm ${selectedChildId ? 'text-foreground' : 'text-gray-400'}`}>
                        {selectedChildId
                          ? (() => {
                              const child = filteredChildren.find(c => c.id === selectedChildId)
                              const cls = classList.find(cl => cl.id === child?.class_id)
                              return `${child?.name}（${cls?.name || child?.class_name || '未知班级'}）`
                            })()
                          : '点击选择幼儿'}
                      </Text>
                    </View>
                  </Picker>
                ) : (
                  <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                    <Text className="block text-sm text-gray-400">
                      {selectedClassIds.length > 0 ? '该班级暂无在读幼儿' : '请先选择班级筛选'}
                    </Text>
                  </View>
                )}
              </View>
            </>
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
            <View className="bg-gray-50 rounded-xl mt-2 p-4">
              <Textarea
                className="w-full bg-transparent"
                style={{ minHeight: '200px', border: 'none', outline: 'none' }}
                placeholder="请输入通知内容..."
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={2000}
              />
            </View>
            <Text className="block text-xs text-muted-foreground mt-1 text-right">
              {content.length}/2000
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #f0f0f0',
          zIndex: 100
        }}
      >
        <Button
          className="w-full bg-primary text-white rounded-xl py-3 gap-2"
          disabled={submitting}
          onClick={handleSubmit}
        >
          <Send size={18} color="#ffffff" />
          <Text>{submitting ? '发布中...' : '发布通知'}</Text>
        </Button>
      </View>
    </View>
  )
}
