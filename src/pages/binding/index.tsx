import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'

export default function BindingPage() {
  const { currentRole } = useAppStore()
  const [childName, setChildName] = useState('')
  const [relationship, setRelationship] = useState('father')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!childName.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!currentRole) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/parent/binding-request',
        method: 'POST',
        data: {
          parent_role_id: currentRole.id,
          child_name: childName.trim(),
          relationship,
        },
      })
      console.log('[Binding] submit:', res.data)
      Taro.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err) {
      console.error('[Binding] error:', err)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    }
    setSubmitting(false)
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <Text className="block text-lg font-bold text-foreground mb-2">绑定幼儿</Text>
      <Text className="block text-sm text-muted-foreground mb-6">
        填写幼儿信息，提交后等待管理员审核
      </Text>

      <Card className="bg-white rounded-xl border-0 shadow-sm mb-6">
        <CardContent className="p-4 space-y-4">
          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>幼儿姓名</Text>
            </Label>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入幼儿真实姓名"
                value={childName}
                onInput={(e) => setChildName(e.detail.value)}
              />
            </View>
          </View>

          <View>
            <Label className="text-sm text-foreground mb-2">
              <Text>与幼儿关系</Text>
            </Label>
            <RadioGroup
              className="flex gap-4 mt-2"
              value={relationship}
              onValueChange={setRelationship}
            >
              <View className="flex items-center gap-2">
                <RadioGroupItem value="father" />
                <Text className="text-sm text-foreground">父亲</Text>
              </View>
              <View className="flex items-center gap-2">
                <RadioGroupItem value="mother" />
                <Text className="text-sm text-foreground">母亲</Text>
              </View>
              <View className="flex items-center gap-2">
                <RadioGroupItem value="guardian" />
                <Text className="text-sm text-foreground">监护人</Text>
              </View>
            </RadioGroup>
          </View>
        </CardContent>
      </Card>

      <Button
        className="w-full bg-primary text-primary-foreground rounded-xl py-3"
        disabled={submitting}
        onClick={handleSubmit}
      >
        <Text className="text-primary-foreground">{submitting ? '提交中...' : '提交申请'}</Text>
      </Button>
    </View>
  )
}
