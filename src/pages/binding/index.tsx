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
import { Baby, Search, UserPlus } from 'lucide-react-taro'

const relationshipOptions = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'grandfather', label: '爷爷/外公' },
  { value: 'grandmother', label: '奶奶/外婆' },
  { value: 'other', label: '其他' },
]

export default function BindingPage() {
  const { currentRole, userId } = useAppStore()
  const [step, setStep] = useState<'search' | 'form'>('search')
  const [searchName, setSearchName] = useState('')
  const [childName, setChildName] = useState('')
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [relationship, setRelationship] = useState('father')
  const [customRelationship, setCustomRelationship] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchResult, setSearchResult] = useState<Array<{ id: string; name: string; gender: string }> | null>(null)

  const handleSearch = async () => {
    const keyword = searchName.trim()
    if (!keyword || keyword.length < 1) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/parent/search-children',
        method: 'GET',
        data: { keyword },
      })

      console.log('[Binding] search result:', res.data)

      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setSearchResult(res.data)
      } else {
        setSearchResult([])
        Taro.showToast({ title: '未找到匹配的幼儿', icon: 'none' })
      }
    } catch (error) {
      console.error('[Binding] search error:', error)
      Taro.showToast({ title: '搜索失败，请重试', icon: 'none' })
    }
  }

  const handleSelectChild = (child: { id: string; name: string }) => {
    setChildName(child.name)
    setSelectedChildId(child.id)
    setStep('form')
  }

  const handleCreateNew = () => {
    setChildName(searchName)
    setSelectedChildId(null)
    setStep('form')
  }

  const handleSubmit = async () => {
    if (!childName.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!currentRole) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (relationship === 'other' && !customRelationship.trim()) {
      Taro.showToast({ title: '请输入具体关系', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/parent/binding-request',
        method: 'POST',
        data: {
          user_id: userId,
          parent_role_id: currentRole.id,
          child_id: selectedChildId,
          child_name: childName.trim(),
          relationship: relationship === 'other' ? 'other' : relationship,
          custom_relationship: relationship === 'other' ? customRelationship.trim() : null,
        },
      })
      console.log('[Binding] submit:', res.data)

      // 检查后端返回的业务状态码（防重复等）
      if (res.data?.code === 400) {
        Taro.showToast({ title: res.data?.msg || '提交失败', icon: 'none' })
        setSubmitting(false)
        return
      }

      Taro.showToast({ title: '申请已提交，等待审核', icon: 'success' })
      setTimeout(() => {
        // 检查页面栈是否有可返回的页面
        const pages = Taro.getCurrentPages()
        if (pages.length > 1) {
          Taro.navigateBack()
        } else {
          // 没有历史记录（如从登录页 redirectTo 进入），跳转到首页
          Taro.switchTab({ url: '/pages/index/index' })
        }
      }, 1500)
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
        {step === 'search' ? '搜索已有幼儿档案或创建新档案' : '填写关系信息，提交后等待管理员审核'}
      </Text>

      {step === 'search' ? (
        <>
          {/* 搜索步骤 */}
          <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
            <CardContent className="p-4">
              <Label className="text-sm text-foreground mb-2">
                <Text>搜索幼儿</Text>
              </Label>
              <View className="flex gap-2 mt-2">
                <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="输入幼儿姓名搜索"
                    value={searchName}
                    onInput={(e) => setSearchName(e.detail.value)}
                  />
                </View>
                <Button
                  className="bg-primary text-white rounded-xl px-4"
                  onClick={handleSearch}
                >
                  <Search size={18} color="#ffffff" />
                </Button>
              </View>
            </CardContent>
          </Card>

          {/* 搜索结果 */}
          {searchResult && searchResult.length > 0 && (
            <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
              <CardContent className="p-4">
                <Text className="block text-sm font-medium text-foreground mb-3">
                  找到以下幼儿档案：
                </Text>
                {searchResult.map((child) => (
                  <View
                    key={child.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2"
                    onClick={() => handleSelectChild(child)}
                  >
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center">
                        <Baby size={20} color="#E8651A" />
                      </View>
                      <View>
                        <Text className="block text-sm font-medium text-foreground">{child.name}</Text>
                        <Text className="block text-xs text-muted-foreground">
                          {child.gender === 'male' ? '男' : '女'}
                        </Text>
                      </View>
                    </View>
                    <Button variant="outline" size="sm">
                      <Text className="text-xs">选择</Text>
                    </Button>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 创建新档案按钮 */}
          <Button
            variant="outline"
            className="w-full rounded-xl py-3 gap-2"
            onClick={handleCreateNew}
          >
            <UserPlus size={18} color="#E8651A" />
            <Text className="text-primary">未找到？创建新档案</Text>
          </Button>
        </>
      ) : (
        <>
          {/* 表单步骤 */}
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
                  className="flex flex-wrap gap-3 mt-2"
                  value={relationship}
                  onValueChange={setRelationship}
                >
                  {relationshipOptions.map((opt) => (
                    <View key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} />
                      <Text className="text-sm text-foreground">{opt.label}</Text>
                    </View>
                  ))}
                </RadioGroup>
              </View>

              {relationship === 'other' && (
                <View>
                  <Label className="text-sm text-foreground mb-2">
                    <Text>具体关系</Text>
                  </Label>
                  <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入具体关系，如：叔叔、阿姨等"
                      value={customRelationship}
                      onInput={(e) => setCustomRelationship(e.detail.value)}
                    />
                  </View>
                </View>
              )}
            </CardContent>
          </Card>

          <View className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl py-3"
              onClick={() => setStep('search')}
            >
              <Text>上一步</Text>
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3"
              disabled={submitting}
              onClick={handleSubmit}
            >
              <Text>{submitting ? '提交中...' : '提交申请'}</Text>
            </Button>
          </View>
        </>
      )}
    </View>
  )
}
