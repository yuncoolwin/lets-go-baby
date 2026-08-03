import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { childrenApi } from '@/utils/api'
import BackButton from '@/components/back-button'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'

const statusOptions = [
  { value: 'active', label: '在读' },
  { value: 'graduated', label: '毕业' },
  { value: 'suspended', label: '休学' },
]

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

export default function ChildAddPage() {
  const [submitting, setSubmitting] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState('active')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [healthInfo, setHealthInfo] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await childrenApi.create({
        name: name.trim(),
        gender,
        birth_date: birthDate,
        status,
        class_id: undefined,
        parent_name: parentName || undefined,
        parent_phone: parentPhone || undefined,
        allergies: allergies || undefined,
        health_info: healthInfo || undefined,
      })
      if (res.code === 200) {
        Taro.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.msg || '创建失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">新增幼儿</Text>
      </View>

      <View className="p-4 space-y-4">
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* 姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">姓名 *</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入幼儿姓名"
                  value={name}
                  onInput={(e) => setName(e.detail.value)}
                />
              </View>
            </View>

            {/* 性别 */}
            <View>
              <Label className="text-sm font-medium text-foreground">性别 *</Label>
              <View className="mt-1 flex gap-2">
                {genderOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      gender === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setGender(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 出生日期 */}
            <View>
              <Label className="text-sm font-medium text-foreground">出生日期 *</Label>
              <View
                className="mt-1 bg-gray-50 rounded-lg px-3 py-2"
                onClick={() => setShowCalendar(true)}
              >
                <Text className="text-sm text-foreground">
                  {birthDate || '请选择出生日期'}
                </Text>
              </View>
            </View>

            {/* 在读状态 */}
            <View>
              <Label className="text-sm font-medium text-foreground">在读状态 *</Label>
              <View className="mt-1 flex gap-2">
                {statusOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      status === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setStatus(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 过敏情况 */}
            <View>
              <Label className="text-sm font-medium text-foreground">过敏情况</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="无"
                  value={allergies}
                  onInput={(e) => setAllergies(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长姓名</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长姓名"
                  value={parentName}
                  onInput={(e) => setParentName(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长电话 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长电话</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长电话"
                  value={parentPhone}
                  onInput={(e) => setParentPhone(e.detail.value)}
                />
              </View>
            </View>

            {/* 健康信息 */}
            <View>
              <Label className="text-sm font-medium text-foreground">健康信息</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入健康信息"
                  value={healthInfo}
                  onInput={(e) => setHealthInfo(e.detail.value)}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <Text className="text-white">{submitting ? '创建中...' : '创建幼儿'}</Text>
        </Button>
      </View>

      {/* 日历选择器浮层 */}
      {showCalendar && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View onClick={() => setShowCalendar(false)} style={{ flex: 1 }} />
          <View className="bg-white rounded-t-2xl p-4">
            <View className="flex justify-end mb-2">
              <Text className="text-primary text-sm" onClick={() => setShowCalendar(false)}>完成</Text>
            </View>
            <Calendar
              mode="single"
              selected={birthDate ? new Date(birthDate) : undefined}
              onSelect={(date) => {
                if (date) {
                  setBirthDate(format(date, 'yyyy-MM-dd'))
                  setShowCalendar(false)
                }
              }}
              className="border-0"
            />
          </View>
        </View>
      )}
    </View>
  )
}
