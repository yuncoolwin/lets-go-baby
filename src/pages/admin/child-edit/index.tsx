import { useState } from 'react'
import { View, Text, Picker, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { childrenApi } from '@/utils/api'
import BackButton from '@/components/back-button'

const statusOptions = [
  { value: 'active', label: '在读' },
  { value: 'graduated', label: '毕业' },
  { value: 'suspended', label: '休学' },
]

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

export default function ChildEditPage() {
  const router = useRouter()
  const { id } = router.params
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 幼儿基本信息
  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState('active')
  const [classId, setClassId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [healthInfo, setHealthInfo] = useState('')

  // 加载数据
  const loadData = async () => {
    if (!id) return
    try {
      const [childRes] = await Promise.all([
        childrenApi.detail(id),
      ])
      if (childRes.code === 200 && childRes.data) {
        const child = childRes.data as any
        setName(child.name || '')
        setGender(child.gender || 'male')
        setBirthDate(child.birth_date || '')
        setStatus(child.status || 'active')
        setClassId(child.class_id || '')
        setParentName(child.parent_name || '')
        setParentPhone(child.parent_phone || '')
        setAllergies(child.allergies || '')
        setHealthInfo(child.health_info || '')
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (id) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [loaded, setLoaded] = useState(false)
    if (!loaded) {
      setLoaded(true)
      loadData()
    }
  }

  // 保存
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
      const payload: Record<string, any> = {
        name: name.trim(),
        gender,
        birth_date: birthDate,
        status,
        class_id: classId || undefined,
        parent_name: parentName || undefined,
        parent_phone: parentPhone || undefined,
        allergies: allergies || undefined,
        health_info: healthInfo || undefined,
      }
      const res = await childrenApi.update(id!, payload)
      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.msg || '保存失败', icon: 'none', duration: 3000 })
        setSubmitting(false)
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none', duration: 3000 })
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Text className="block">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="block text-lg font-semibold text-foreground">编辑幼儿</Text>
      </View>

      <ScrollView className="p-4" scrollY>
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <Text className="block text-base font-semibold text-foreground">基本信息</Text>

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
                    <Text className="block text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 出生日期 */}
            <View>
              <Label className="text-sm font-medium text-foreground">出生日期 *</Label>
              <Picker
                mode="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.detail.value)}
              >
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="block text-sm text-foreground">
                    {birthDate || '请选择出生日期'}
                  </Text>
                </View>
              </Picker>
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
                    <Text className="block text-sm">{opt.label}</Text>
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

            {/* 保存按钮 */}
            <View className="pt-4">
              <View
                className={`w-full py-3 rounded-lg text-center ${
                  submitting ? 'bg-gray-300' : 'bg-primary'
                }`}
                onClick={submitting ? undefined : handleSubmit}
              >
                <Text className="block text-white font-medium">
                  {submitting ? '保存中...' : '保存'}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  )
}