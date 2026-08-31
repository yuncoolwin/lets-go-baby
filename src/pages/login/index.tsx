import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import logoUrl from '@/assets/logo.png'

const APP_VERSION = '1.0.0'

export default function LoginPage() {
  const { wxLogin, phoneLogin, isLoading } = useAppStore()

  const isDev = (() => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return true
    try {
      const info = (Taro as any).getAccountInfoSync?.()
      const envVersion = info?.miniProgram?.envVersion ?? 'release'
      return envVersion !== 'release'
    } catch (e) {
      return false
    }
  })()

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

  const handlePhoneLogin = async (e: any) => {
    console.log('[Login] handlePhoneLogin called, detail:', e?.detail)
    const phoneCode = e?.detail?.code
    if (!phoneCode) {
      Taro.showToast({ title: '未授权手机号，请重试', icon: 'none' })
      return
    }
    try {
      const { code } = await new Promise<any>((resolve, reject) => {
        Taro.login({ success: resolve, fail: reject })
      })
      if (!code) {
        Taro.showToast({ title: '未获取到微信授权code', icon: 'none' })
        return
      }
      const result = await phoneLogin(code, phoneCode)
      handleLoginResult(result)
    } catch (err) {
      console.error('[Login] phoneLogin error:', err)
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
      {/* 微信授权登录（右上角小按钮） */}
      <View
        className="flex items-center"
        style={{ position: 'fixed', top: 60, right: 16, zIndex: 1001 }}
      >
        <Button
          variant="ghost"
          className="h-8 px-2"
          onClick={handleWxLogin}
          disabled={isLoading}
        >
          <Text className="text-xs text-gray-500">微信授权登录</Text>
        </Button>
      </View>

      {/* Logo 区域 */}
      <View className="mb-12 flex flex-col items-center">
        <Image
          src={logoUrl}
          className="w-80 h-80 rounded-3xl"
          mode="aspectFit"
        />
      </View>

      {/* 登录按钮 */}
      <View className="w-full max-w-sm space-y-4">
        <Button
          className="w-full h-12 rounded-xl bg-primary text-white text-base font-medium"
          openType="getPhoneNumber"
          onGetPhoneNumber={handlePhoneLogin}
          disabled={isLoading}
        >
          {isLoading ? '登录中...' : '手机号一键登录'}
        </Button>
      </View>

      {/* 底部说明 */}
      <View className="mt-12 text-center">
        <Text className="block text-xs text-gray-400">
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>

      {isDev && (
        <View
          className="text-center"
          style={{ position: 'fixed', bottom: 16, left: 0, right: 0 }}
        >
          <Text className="block text-xs text-gray-300 select-none">
            版本 v{APP_VERSION}
          </Text>
        </View>
      )}
    </View>
  )
}
