import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore, type RoleType } from '@/store/app'
import { GraduationCap, Shield, Check } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'

const roleConfig: Record<string, { name: string; desc: string; icon: any; color: string; isImage?: boolean }> = {
  parent: {
    name: '家长',
    desc: '查看宝宝在园状态、接送记录、每日反馈',
    icon: rabbitLogo,
    color: '#E8651A',
    isImage: true,
  },
  teacher: {
    name: '教师',
    desc: '管理班级、点名、记录幼儿日常、发布通知',
    icon: GraduationCap,
    color: '#3B82F6',
  },
  admin: {
    name: '管理员',
    desc: '管理幼儿档案、班级、教师、审核绑定',
    icon: Shield,
    color: '#10B981',
  },
}

export default function RoleSelectPage() {
  const { roles, selectRole } = useAppStore()
  const [selectedRole, setSelectedRole] = useState<RoleType>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!selectedRole) return

    setLoading(true)
    await selectRole(selectedRole)
    setLoading(false)

    // 根据角色跳转
    if (selectedRole === 'parent') {
      Taro.switchTab({ url: '/pages/index/index' })
    } else if (selectedRole === 'teacher') {
      Taro.switchTab({ url: '/pages/records/index' })
    } else if (selectedRole === 'admin') {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6">
      <View className="mb-6">
        <Text className="block text-xl font-bold text-gray-800">选择您的角色</Text>
        <Text className="block text-sm text-gray-500 mt-1">
          您的账号拥有多个角色，请选择当前要使用的角色
        </Text>
      </View>

      <View className="space-y-3">
        {roles.map((role) => {
          const config = roleConfig[role.role_type || '']
          if (!config) return null

          const Icon = config.icon
          const isImage = config.isImage
          const isSelected = selectedRole === role.role_type

          return (
            <Card
              key={role.id}
              className={`border-2 transition-all ${
                isSelected ? 'border-primary bg-primary bg-opacity-5' : 'border-transparent bg-white'
              }`}
              onClick={() => setSelectedRole(role.role_type)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <View
                  className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  {isImage ? (
                    <Image src={Icon} className="w-10 h-10 rounded-lg" mode="aspectFit" />
                  ) : (
                    <Icon size={24} color={config.color} />
                  )}
                </View>

                <View className="flex-1">
                  <Text className="block text-base font-semibold text-gray-800">
                    {config.name}
                  </Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    {config.desc}
                  </Text>
                  {role.real_name && (
                    <Text className="block text-xs text-gray-400 mt-1">
                      {role.real_name}
                    </Text>
                  )}
                </View>

                {isSelected && (
                  <View className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check size={14} color="#ffffff" />
                  </View>
                )}
              </CardContent>
            </Card>
          )
        })}
      </View>

      <View className="mt-8">
        <Button
          className="w-full h-12 rounded-xl bg-primary text-white text-base font-medium"
          disabled={!selectedRole || loading}
          onClick={handleConfirm}
        >
          {loading ? '切换中...' : '确认选择'}
        </Button>
      </View>
    </View>
  )
}
