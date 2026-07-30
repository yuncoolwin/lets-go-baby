import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/app'
import { Shield, GraduationCap } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import logoUrl from '@/assets/logo.png'

export default function LoginPage() {
  const { wxLogin, isLoading } = useAppStore()
  const [loginMode, setLoginMode] = useState<'normal' | 'mock'>('normal')

  const handleWxLogin = async () => {
    console.log('[Login] handleWxLogin called, env:', Taro.getEnv())
    // 在真实小程序环境中调用微信登录
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      // 10秒超时处理
      const loginWithTimeout = () => {
        return new Promise<{ code: string }>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('获取微信授权超时，请重试'))
          }, 10000)

          Taro.login({
            success: (res) => {
              clearTimeout(timer)
              if (res.code) {
                resolve({ code: res.code })
              } else {
                reject(new Error('未获取到微信授权code'))
              }
            },
            fail: (err) => {
              clearTimeout(timer)
              reject(new Error(err?.errMsg || '微信登录失败'))
            },
          })
        })
      }

      try {
        console.log('[Login] calling wx.login...')
        const { code } = await loginWithTimeout()
        console.log('[Login] wx.login success, code:', code)
        const result = await wxLogin(code)
        console.log('[Login] wxLogin result:', result)
        handleLoginResult(result)
      } catch (err) {
        console.error('[Login] wxLogin error:', err)
        const errMsg = err instanceof Error ? err.message : '登录失败，请重试'
        Taro.showToast({ title: errMsg, icon: 'none' })
      }
    } else {
      // H5 环境：使用 mock 登录
      console.log('[Login] H5 env, using mock login')
      try {
        const result = await wxLogin('h5_demo')
        handleLoginResult(result)
      } catch (err) {
        console.error('[Login] H5 login error:', err)
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    }
  }

  const handleMockLogin = async (role: string) => {
    try {
      const result = await wxLogin(`mock_${role}`, role)
      handleLoginResult(result)
    } catch (err) {
      console.error('[Login] mock login error:', err)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  }

  const handleLoginResult = (result: {
    needRoleSelection: boolean
    targetRole: string | null
    hasBoundChildren: boolean
    error?: boolean
  }) => {
    // 登录失败，停留在登录页
    if (result.error) return

    if (result.needRoleSelection) {
      // 多角色，需要选择
      Taro.navigateTo({ url: '/pages/role-select/index' })
    } else if (result.targetRole === 'parent' && !result.hasBoundChildren) {
      // 家长但未绑定孩子
      Taro.redirectTo({ url: '/pages/binding/index' })
    } else if (result.targetRole) {
      // 有目标角色，正常进入首页
      Taro.switchTab({ url: '/pages/index/index' })
    } else {
      // targetRole 为 null 且没有 error，兜底进首页
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-6">
      {/* Logo 区域 */}
      <View className="mb-12 flex flex-col items-center">
        <Image
          src={logoUrl}
          className="w-40 h-40 rounded-3xl"
          mode="aspectFit"
        />
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
                  <Image src={rabbitLogo} className="w-5 h-5 rounded-full" mode="aspectFit" />
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
