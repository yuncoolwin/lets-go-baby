import { useState, useEffect, useCallback } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { childrenApi, classApi } from '@/utils/api'
import BackButton from '@/components/back-button'

interface ClassItem {
  id: string
  name: string
  level: string
}

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
  const [classes, setClasses] = useState<ClassItem[]>([])

  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState('active')
  const [classId, setClassId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [healthInfo, setHealthInfo] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [childRes, classRes] = await Promise.all([
        childrenApi.detail(id),
        classApi.list({ page: 1, page_size: 100 }),
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
      if (classRes.code === 200 && classRes.data) {
        const classData = classRes.data as any
        setClasses(Array.isArray(classData.list) ? classData.list : [])
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      const res = await childrenApi.update(id!, {
        name: name.trim(),
        gender,
        birth_date: birthDate,
        status,
        class_id: classId || undefined,
        parent_name: parentName || undefined,
        parent_phone: parentPhone || undefined,
        allergies: allergies || undefined,
        health_info: healthInfo || undefined,
      })
      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        // 捕获容量错误等后端异常
        const errMsg = res.msg || (res as any).message || '保存失败'
        Taro.showToast({ title: errMsg, icon: 'none', duration: 3000 })
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
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">编辑幼儿</Text>
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
              <Picker
                mode="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.detail.value)}
              >
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="text-sm text-foreground">
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
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 班级 */}
            <View>
              <Label className="text-sm font-medium text-foreground">所在班级</Label>
              <View className="mt-1 flex flex-wrap gap-2">
                <View
                  className={`px-4 py-2 rounded-lg text-sm ${
                    !classId ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                  }`}
                  onClick={() => setClassId('')}
                >
                  <Text className="text-sm">未分班</Text>
                </View>
                {classes.map((cls) => (
                  <View
                    key={cls.id}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      classId === cls.id ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setClassId(cls.id)}
                  >
                    <Text className="text-sm">{cls.name}</Text>
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
          <Text className="text-white">{submitting ? '保存中...' : '保存修改'}</Text>
        </Button>
      </View>
    </View>
  )
}
