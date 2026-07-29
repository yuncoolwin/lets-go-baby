import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/app'
import { Baby, Shield, GraduationCap } from 'lucide-react-taro'
import logoUrl from '@/assets/logo.png'

export default function LoginPage() {
  const { wxLogin, isLoading } = useAppStore()
  const [loginMode, setLoginMode] = useState<'normal' | 'mock'>('normal')

  const handleWxLogin = async () => {
    // 在真实小程序环境中调用微信登录
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      Taro.login({
        success: async (res) => {
          const result = await wxLogin(res.code)
          handleLoginResult(result)
        },
        fail: (err) => {
          console.error('[Login] wx.login failed:', err)
          Taro.showToast({ title: '登录失败', icon: 'none' })
        },
      })
    } else {
      // H5 环境：使用 mock 登录
      const result = await wxLogin('h5_demo')
      handleLoginResult(result)
    }
  }

  const handleMockLogin = async (role: string) => {
    const result = await wxLogin(`mock_${role}`, role)
    handleLoginResult(result)
  }

  const handleLoginResult = (result: {
    needRoleSelection: boolean
    targetRole: string | null
    hasBoundChildren: boolean
  }) => {
    if (result.needRoleSelection) {
      // 多角色，需要选择
      Taro.navigateTo({ url: '/pages/role-select/index' })
    } else if (result.targetRole === 'parent' && !result.hasBoundChildren) {
      // 家长但未绑定孩子
      Taro.redirectTo({ url: '/pages/binding/index' })
    } else {
      // 正常进入首页
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-6">
      {/* Logo 区域 */}
      <View className="mb-12 flex flex-col items-center">
        <Image
          src={logoUrl}
          className="w-32 h-32 rounded-3xl mb-4"
          mode="aspectFit"
        />
        <Text className="block text-2xl font-bold text-gray-800">力高稚家</Text>
        <Text className="block text-sm text-gray-500 mt-2">托育管理系统</Text>
      </View>

      {/* 登录按钮 */}
      <View className="w-full max-w-sm space-y-4">
        {loginMode === 'normal' ? (
          <>
            <Button
              className="w-full h-12 rounded-xl bg-primary text-white text-base font-medium"
              onClick={handleWxLogin}
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '微信授权登录'}
            </Button>

            <View className="flex items-center gap-3 py-4">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400">开发测试</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            <Button
              variant="outline"
              className="w-full h-10 rounded-xl text-sm text-gray-600"
              onClick={() => setLoginMode('mock')}
            >
              使用角色模拟登录
            </Button>
          </>
        ) : (
          <>
            <Text className="block text-center text-sm text-gray-500 mb-4">
              选择角色登录（测试用）
            </Text>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl justify-start gap-3"
                  onClick={() => handleMockLogin('parent')}
                  disabled={isLoading}
                >
                  <Baby size={20} color="#E8651A" />
                  <Text className="text-base">家长端登录</Text>
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl justify-start gap-3"
                  onClick={() => handleMockLogin('teacher')}
                  disabled={isLoading}
                >
                  <GraduationCap size={20} color="#3B82F6" />
                  <Text className="text-base">教师端登录</Text>
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl justify-start gap-3"
                  onClick={() => handleMockLogin('admin')}
                  disabled={isLoading}
                >
                  <Shield size={20} color="#10B981" />
                  <Text className="text-base">管理员登录</Text>
                </Button>
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              className="w-full h-10 text-sm text-gray-500"
              onClick={() => setLoginMode('normal')}
            >
              返回
            </Button>
          </>
        )}
      </View>

      {/* 底部说明 */}
      <View className="mt-12 text-center">
        <Text className="block text-xs text-gray-400">
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  )
}
