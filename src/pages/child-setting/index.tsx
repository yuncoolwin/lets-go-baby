import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import BackButton from '@/components/back-button'
import rabbitLogo from '@/assets/rabbit-logo.png'
import { Network } from '@/network'
import { formatAge } from '@/utils/format'
import { CalendarOverlay } from '@/components/ui/calendar-overlay'


interface ChildDetail {
  id: string
  child_name: string
  gender: string
  birth_date: string | null
  status: string
  class_id: string | null
  class_name: string | null
  room: string | null
  allergies: string | null
  health_info: string | null
  relationship: string | null
  custom_relationship: string | null
}

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: '在读', className: 'bg-green-100 text-green-700' },
  graduated: { label: '毕业', className: 'bg-blue-100 text-blue-700' },
  suspended: { label: '休学', className: 'bg-yellow-100 text-yellow-700' }
}

const relationshipOptions = ['爸爸', '妈妈', '爷爷', '奶奶', '其他']

const genderMap: Record<string, string> = { male: '男', female: '女' }
const genderOptions = ['男', '女']

export default function ChildSettingPage() {
  const [childId, setChildId] = useState<string>('')
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // 表单状态
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [allergies, setAllergies] = useState('')
  const [relationship, setRelationship] = useState('')
  const [customRelationship, setCustomRelationship] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    const id = params?.childId || params?.id
    if (id) {
      setChildId(id)
      loadChild(id)
    } else {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      setLoading(false)
    }
  }, [])

  const loadChild = async (id: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/parent/child/${id}`,
        method: 'GET'
      })
      console.log('[ChildSetting] detail:', res.data)
      if (res.data.code === 200 && res.data.data) {
        const data = res.data.data
        setChild(data)
        setName(data.child_name || '')
        setGender(genderMap[data.gender] || '')
        setBirthDate(data.birth_date || '')
        setAllergies(data.allergies || '')
        setRelationship(data.relationship || '')
        setCustomRelationship(data.custom_relationship || '')
      } else {
        Taro.showToast({ title: '幼儿信息不存在', icon: 'none' })
      }
    } catch (err) {
      console.error('[ChildSetting] loadChild error:', err)
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const genderValue = gender === '男' ? 'male' : gender === '女' ? 'female' : ''
      const res = await Network.request({
        url: '/api/parent/child/update',
        method: 'POST',
        data: {
          child_id: childId,
          name: name.trim(),
          gender: genderValue,
          birth_date: birthDate,
          allergies: allergies.trim(),
          relationship,
          custom_relationship: relationship === '其他' ? customRelationship.trim() : ''
        }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        // 刷新数据并切回只读模式
        await loadChild(childId)
        setIsEditing(false)
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

  const handleCancel = () => {
    // 恢复原始数据
    if (child) {
      setName(child.child_name || '')
      setGender(genderMap[child.gender] || '')
      setBirthDate(child.birth_date || '')
      setAllergies(child.allergies || '')
      setRelationship(child.relationship || '')
      setCustomRelationship(child.custom_relationship || '')
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-muted-foreground">加载中...</Text>
      </View>
    )
  }

  if (!child) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Text className="text-muted-foreground mb-4">幼儿信息不存在</Text>
        <BackButton />
      </View>
    )
  }

  const genderLabel = genderMap[child.gender] || child.gender

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center justify-between mb-4">
        <View className="flex items-center">
          <BackButton />
          <Text className="text-lg font-semibold text-foreground ml-2">
            {isEditing ? '编辑幼儿信息' : '幼儿信息详情'}
          </Text>
        </View>
        {!isEditing && (
          <Button
            size="sm"
            className="bg-primary text-white rounded-lg px-4 py-1"
            onClick={() => setIsEditing(true)}
          >
            <Text className="text-sm">编辑</Text>
          </Button>
        )}
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
              <Text className="text-sm text-muted-foreground">性别</Text>
              <Text className="text-sm text-foreground">{genderLabel}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">出生日期</Text>
              <Text className="text-sm text-foreground">{child.birth_date || '未设置'}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">过敏情况</Text>
              <Text className="text-sm text-foreground">{child.allergies || '无'}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">与幼儿关系</Text>
              <Text className="text-sm text-foreground">
                {child.relationship === '其他' && child.custom_relationship
                  ? child.custom_relationship
                  : child.relationship || '未设置'}
              </Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">所在班级</Text>
              <Text className="text-sm text-foreground">{child.class_name || '未分配'}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">教室</Text>
              <Text className="text-sm text-foreground">{child.room || '未分配'}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-sm text-muted-foreground">在读状态</Text>
              <Text className="text-sm text-foreground">{statusMap[child.status]?.label || child.status}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 编辑模式表单 */}
      {isEditing && (
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
              <View
                className="bg-gray-50 rounded-lg px-3 py-2"
                onClick={() => setShowCalendar(true)}
              >
                <Text className="text-sm text-foreground">{birthDate || '请选择出生日期'}</Text>
              </View>
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

            {/* 编辑模式操作按钮 */}
            <View className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-gray-100 text-foreground rounded-lg py-3"
                onClick={handleCancel}
                disabled={saving}
              >
                <Text>取消</Text>
              </Button>
              <Button
                className="flex-1 bg-primary text-white rounded-lg py-3"
                onClick={handleSave}
                disabled={saving}
              >
                <Text>{saving ? '保存中...' : '保存修改'}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 日历选择器浮层 */}
      <CalendarOverlay
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        value={birthDate}
        onChange={(dateStr) => { setBirthDate(dateStr); setShowCalendar(false) }}
      />
    </View>
  )
}
