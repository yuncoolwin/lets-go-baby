import { useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Network } from '@/network'
import { useAppStore } from '@/store/app'
import { Search } from 'lucide-react-taro'
import { getNameInitial } from '@/utils/helpers'


const relationshipOptions = [
  { value: 'father', label: '爸爸' },
  { value: 'mother', label: '妈妈' },
  { value: 'grandfather', label: '爷爷' },
  { value: 'grandmother', label: '奶奶' },
  { value: 'other', label: '其他' },
]

export default function BindingPage() {
  const { currentRole } = useAppStore()
  const [step, setStep] = useState<'search' | 'form'>('search')
  const [searchName, setSearchName] = useState('')
  const [childName, setChildName] = useState('')
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [relationship, setRelationship] = useState('father')
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [allergies, setAllergies] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [customRelationship, setCustomRelationship] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchResult, setSearchResult] = useState<Array<{ id: string; name: string; gender: string; bound?: boolean }> | null>(null)

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

      const body = res.data
      if (body && body.code === 200 && Array.isArray(body.data) && body.data.length > 0) {
        setSearchResult(body.data)
      } else {
        setSearchResult([])
        Taro.showToast({ title: '未找到匹配的幼儿', icon: 'none' })
      }
    } catch (error) {
      console.error('[Binding] search error:', error)
      Taro.showToast({ title: '搜索失败，请重试', icon: 'none' })
    }
  }

  const handleSelectChild = async (child: { id: string; name: string }) => {
    setChildName(child.name)
    setSelectedChildId(child.id)
    setStep('form')
    // 查询该幼儿已有资料，回填表单（灰字显示、可编辑）
    try {
      const res: any = await Network.request({ url: `/api/parent/children/${child.id}/profile` })
      console.log('[Binding] child profile:', res.data)
      // 兼容双层包装：放行时 res.data.data 为 { code, msg, data: 幼儿 }；403 时 res.data.data 为 null
      const envelope: any = res.data?.data
      const profile: any = envelope && envelope.code && envelope.data ? envelope.data : envelope
      if (profile?.id) {
        setNickname(profile.nickname || '')
        setGender(profile.gender === 'male' || profile.gender === 'female' ? profile.gender : '')
        setBirthDate(profile.birth_date ? String(profile.birth_date).slice(0, 10) : '')
        setAllergies(profile.allergies || '')
        setParentPhone(profile.parent_phone || '')
      }
    } catch (error) {
      console.error('[Binding] load child profile error:', error)
    }
  }

  const handleSubmit = async () => {
    if (!selectedChildId) {
      Taro.showToast({ title: '请先搜索选择幼儿', icon: 'none' })
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
          child_id: selectedChildId,
          relationship: relationship === 'other' ? 'other' : relationship,
          custom_relationship: relationship === 'other' ? customRelationship.trim() : null,
          nickname: nickname.trim() || null,
          gender: gender || null,
          birth_date: birthDate || null,
          allergies: allergies.trim() || null,
          parent_phone: parentPhone.trim() || null,
        },
      })
      console.log('[Binding] submit:', res.data)

      // 检查后端返回的业务状态码（未选幼儿/幼儿不存在/防重复等）
      if (res.data?.code !== 200) {
        Taro.showToast({ title: res.data?.msg || '提交失败', icon: 'none' })
        setSubmitting(false)
        return
      }

      Taro.showToast({ title: '申请已提交，等待审核', icon: 'success' })
      // 保持按钮禁用，等待导航
      setTimeout(() => {
        try {
          // 检查页面栈是否有可返回的页面
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack()
          } else {
            // 没有历史记录（如从登录页 redirectTo 进入），跳转到首页
            Taro.switchTab({ url: '/pages/index/index' })
          }
        } catch (e) {
          console.error('[Binding] navigation error:', e)
          // 导航失败时重新启用按钮
          setSubmitting(false)
        }
      }, 1500)
    } catch (err) {
      console.error('[Binding] error:', err)
      Taro.showToast({ title: '提交失败', icon: 'none' })
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-background p-4">
      <Text className="block text-lg font-bold text-foreground mb-2">绑定幼儿</Text>
      <Text className="block text-sm text-muted-foreground mb-6">
        {step === 'search' ? '搜索园方已录入的幼儿档案，选中后提交绑定申请' : '确认幼儿信息并填写关系，提交后等待管理员审核'}
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
                    onClick={() => {
                      if (child.bound) {
                        Taro.showToast({ title: '该幼儿已在您的绑定列表中', icon: 'none' })
                        return
                      }
                      handleSelectChild(child)
                    }}
                  >
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center overflow-hidden">
                        <View className={`w-10 h-10 rounded-full flex items-center justify-center ${child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                          <Text className={`text-base font-bold ${child.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`}>
                            {getNameInitial(child.name)}
                          </Text>
                        </View>
                      </View>
                      <View>
                        <View className="flex items-center gap-2">
                          <Text className="block text-sm font-medium text-foreground">{child.name}</Text>
                          {child.bound && (
                            <View className="px-2 py-1 rounded bg-gray-100">
                              <Text className="text-xs text-gray-500">已绑定</Text>
                            </View>
                          )}
                        </View>
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

          {searchResult && searchResult.length === 0 && (
            <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
              <CardContent className="p-4">
                <Text className="block text-sm text-muted-foreground text-center">
                  未找到匹配的幼儿档案，请联系园方录入后再绑定
                </Text>
              </CardContent>
            </Card>
          )}
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
                  <Text className="block text-sm text-foreground">{childName}</Text>
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>幼儿昵称（选填）</Text>
                </Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                  <Input
                    style={{ width: '100%', backgroundColor: 'transparent', fontSize: '14px', color: '#6b7280' }}
                    placeholder="请输入幼儿昵称"
                    value={nickname}
                    onInput={(e) => setNickname(e.detail.value)}
                    maxlength={20}
                  />
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>幼儿性别</Text>
                </Label>
                <View className="flex flex-wrap gap-3 mt-2" style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
                  {(['male', 'female'] as const).map((g) => (
                    <Text
                      key={g}
                      className={`block text-sm rounded-full px-4 py-2 ${gender === g ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setGender(gender === g ? '' : g)}
                    >
                      {g === 'male' ? '男' : '女'}
                    </Text>
                  ))}
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>出生日期</Text>
                </Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                  <Picker mode="date" value={birthDate} onChange={(e) => setBirthDate(e.detail.value)}>
                    <Text className={`block text-sm ${birthDate ? 'text-foreground' : 'text-gray-400'}`}>
                      {birthDate || '请选择出生日期'}
                    </Text>
                  </Picker>
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>过敏状况（选填）</Text>
                </Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                  <Input
                    style={{ width: '100%', backgroundColor: 'transparent', fontSize: '14px', color: '#6b7280' }}
                    placeholder="如：花粉、牛奶过敏，无则留空"
                    value={allergies}
                    onInput={(e) => setAllergies(e.detail.value)}
                    maxlength={100}
                  />
                </View>
              </View>

              <View>
                <Label className="text-sm text-foreground mb-2">
                  <Text>家长电话</Text>
                </Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                  <Input
                    style={{ width: '100%', backgroundColor: 'transparent', fontSize: '14px', color: '#6b7280' }}
                    placeholder="请输入家长联系电话"
                    type="number"
                    value={parentPhone}
                    onInput={(e) => setParentPhone(e.detail.value)}
                    maxlength={11}
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
                      placeholder="请输入具体关系，如：外公、外婆等"
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
