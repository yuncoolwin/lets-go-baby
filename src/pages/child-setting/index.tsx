import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import BackButton from '@/components/back-button'
import { formatAge } from '@/utils/format'
import rabbitLogo from '@/assets/rabbit-logo.png'

interface ChildInfo {
  id: string
  child_id: string
  child_name: string
  relationship: string
  custom_relationship: string | null
  status: string
  allergies: string | null
  birth_date: string | null
  gender: string | null
  class_name: string | null
  room: string | null
}

const genderOptions = ['男', '女']
const relationshipOptions = ['爸爸', '妈妈', '爷爷', '奶奶', '其他']

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在读', className: 'bg-green-100 text-green-700' },
  graduated: { label: '毕业', className: 'bg-blue-100 text-blue-700' },
  suspended: { label: '休学', className: 'bg-orange-100 text-orange-700' },
}

export default function ChildSettingPage() {
  const router = useRouter()
  const { childId } = router.params
  const [child, setChild] = useState<ChildInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 表单字段
  const [name, setName] = useState('')
  const [gender, setGender] = useState('男')
  const [birthDate, setBirthDate] = useState('')
  const [allergies, setAllergies] = useState('')
  const [relationship, setRelationship] = useState('爸爸')
  const [customRelationship, setCustomRelationship] = useState('')

  const loadData = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/parent/child/${childId}`,
      })
      console.log('[ChildSetting] loadData:', res.data)
      if (res.data.code === 200 && res.data.data) {
        const data = res.data.data as ChildInfo
        setChild(data)
        setName(data.child_name || '')
        setGender(data.gender === 'female' ? '女' : '男')
        setBirthDate(data.birth_date || '')
        setAllergies(data.allergies || '')
        setRelationship(
          data.relationship === 'father' ? '爸爸' :
          data.relationship === 'mother' ? '妈妈' :
          data.relationship === 'grandfather' ? '爷爷' :
          data.relationship === 'grandmother' ? '奶奶' : '其他'
        )
        setCustomRelationship(data.custom_relationship || '')
      } else {
        Taro.showToast({ title: res.data.msg || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[ChildSetting] loadData error:', err)
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const relationshipMap: Record<string, string> = {
        '爸爸': 'father',
        '妈妈': 'mother',
        '爷爷': 'grandfather',
        '奶奶': 'grandmother',
        '其他': 'other',
      }
      const res = await Network.request({
        url: `/api/parent/child/${childId}`,
        method: 'PATCH',
        data: {
          name: name.trim(),
          gender: gender === '女' ? 'female' : 'male',
          birth_date: birthDate,
          allergies: allergies.trim() || '无',
          relationship: relationshipMap[relationship],
          custom_relationship: relationship === '其他' ? customRelationship.trim() : null,
        },
      })
      console.log('[ChildSetting] save:', res.data)
      if (res.data.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 800)
      } else {
        Taro.showToast({ title: res.data.msg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[ChildSetting] save error:', err)
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4 rounded" />
        <Skeleton className="h-48 w-full mb-3 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </View>
    )
  }

  if (!child) {
    return (
      <View className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <Text className="text-sm text-muted-foreground mb-4">幼儿信息不存在</Text>
        <BackButton />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center mb-4">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground ml-2">幼儿信息设置</Text>
      </View>

      {/* 头像和基本信息 */}
      <Card className="mb-4 bg-white rounded-xl border-0 shadow-sm">
        <CardContent className="p-4">
          <View className="flex items-center gap-3 mb-4">
            <View className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              <Image src={rabbitLogo} className="w-16 h-16 rounded-full" mode="aspectFit" />
            </View>
            <View className="flex-1">
              <Text className="block text-lg font-semibold text-foreground">{child.child_name}</Text>
              <View className="flex items-center gap-2 mt-1">
                <Badge className={`${statusMap[child.status]?.className || 'bg-gray-100 text-gray-700'} text-xs`}>
                  <Text className="text-xs">{statusMap[child.status]?.label || child.status}</Text>
                </Badge>
                {child.birth_date && (
                  <Text className="text-xs text-muted-foreground">{formatAge(child.birth_date)}</Text>
                )}
              </View>
            </View>
          </View>

          {/* 只读信息 */}
          <View className="space-y-3 pt-3 border-t border-border">
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">所在班级</Text>
              <Text className="text-sm text-foreground">{child.class_name || '未分配'}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">教室</Text>
              <Text className="text-sm text-foreground">{child.room || '未分配'}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 可编辑表单 */}
      <Card className="mb-4 bg-white rounded-xl border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* 姓名 */}
          <View>
            <Text className="block text-sm text-muted-foreground mb-2">幼儿姓名</Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2">
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
            <Text className="block text-sm text-muted-foreground mb-2">性别</Text>
            <View className="flex gap-2">
              {genderOptions.map((opt) => (
                <View
                  key={opt}
                  className={`px-4 py-2 rounded-lg text-sm ${gender === opt ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'}`}
                  onClick={() => setGender(opt)}
                >
                  <Text className="text-sm">{opt}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 出生日期 */}
          <View>
            <Text className="block text-sm text-muted-foreground mb-2">出生日期</Text>
            <Picker
              mode="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.detail.value)}
            >
              <View className="bg-gray-50 rounded-lg px-3 py-2">
                <Text className="text-sm text-foreground">{birthDate || '请选择出生日期'}</Text>
              </View>
            </Picker>
          </View>

          {/* 过敏情况 */}
          <View>
            <Text className="block text-sm text-muted-foreground mb-2">过敏情况</Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2">
              <Input
                className="w-full bg-transparent text-sm"
                placeholder="请输入过敏情况，如无请填写'无'"
                value={allergies}
                onInput={(e) => setAllergies(e.detail.value)}
              />
            </View>
          </View>

          {/* 与幼儿关系 */}
          <View>
            <Text className="block text-sm text-muted-foreground mb-2">与幼儿关系</Text>
            <View className="flex gap-2 flex-wrap">
              {relationshipOptions.map((opt) => (
                <View
                  key={opt}
                  className={`px-4 py-2 rounded-lg text-sm ${relationship === opt ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'}`}
                  onClick={() => setRelationship(opt)}
                >
                  <Text className="text-sm">{opt}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 自定义关系 */}
          {relationship === '其他' && (
            <View>
              <Text className="block text-sm text-muted-foreground mb-2">请填写关系</Text>
              <View className="bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="如：外公、外婆、姑姐等"
                  value={customRelationship}
                  onInput={(e) => setCustomRelationship(e.detail.value)}
                />
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <Button
        className="w-full bg-primary text-white rounded-lg py-3"
        onClick={handleSave}
        disabled={saving}
      >
        <Text>{saving ? '保存中...' : '保存修改'}</Text>
      </Button>
    </View>
  )
}
