import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Separator } from '@/components/ui/separator'
import { useAppStore, type RoleType } from '@/store/app'
import { getRelationshipLabel } from '@/utils/helpers'
import { User, ChevronRight, LogOut, Users, Shield, ShieldCheck } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import TabBar from '@/components/tab-bar'

export default function ProfilePage() {
  const {
    nickname, roles, currentRole, currentRoleIndex,
    children, currentChildIndex, isLoggedIn, setCurrentRole, logout, fetchUserInfo,
  } = useAppStore()

  const currentChild = children[currentChildIndex] || null

  // 根据角色计算显示名称
  const getDisplayName = () => {
    if (!currentRole) return nickname || '用户'
    switch (currentRole.role_type) {
      case 'parent':
        if (currentChild) {
          const relText = currentChild.relationship === 'other' && currentChild.custom_relationship
            ? currentChild.custom_relationship
            : (getRelationshipLabel(currentChild.relationship) || '家长')
          return `${currentChild.name}${relText}`
        }
        return nickname || '新用户'
      case 'teacher':
        // 教师显示昵称
        return nickname || currentRole.real_name || '老师'
      case 'admin':
        return currentRole.real_name || nickname || '管理员'
      case 'superadmin':
        return currentRole.real_name || nickname || '超级管理员'
      default:
        return nickname || '用户'
    }
  }

  // 根据角色计算副标题
  const getSubTitle = () => {
    if (!currentRole) return ''
    switch (currentRole.role_type) {
      case 'parent':
        return ''
      case 'teacher':
        return `教师 · ${currentRole.real_name || ''}`
      case 'admin':
        return '管理员'
      case 'superadmin':
        return '超级管理员'
      default:
        return ''
    }
  }

  Taro.useDidShow(() => {
    fetchUserInfo()
  })

  const displayName = getDisplayName()
  const subTitle = getSubTitle()

  const getRoleName = (role: RoleType) => {
    switch (role) {
      case 'parent': return '家长'
      case 'teacher': return '教师'
      case 'admin': return '管理员'
      case 'superadmin': return '超级管理员'
      default: return '未知'
    }
  }

  const getRoleIcon = (role: RoleType): { type: 'image'; src: string } | { type: 'component'; component: typeof Users } => {
    switch (role) {
      case 'parent': return { type: 'image', src: rabbitLogo }
      case 'teacher': return { type: 'component', component: Users }
      case 'admin': return { type: 'component', component: Shield }
      case 'superadmin': return { type: 'component', component: ShieldCheck }
      default: return { type: 'component', component: User }
    }
  }

  if (!isLoggedIn) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Image src={rabbitLogo} className="w-20 h-20 rounded-full mb-4" mode="aspectFit" />
        <Text className="block text-base text-muted-foreground mb-4">请先登录</Text>
        <Button
          className="bg-primary text-primary-foreground rounded-xl"
          onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
        >
          <Text>去登录</Text>
        </Button>
        <TabBar />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-24">
      {/* 用户信息 */}
      <View className="flex items-center gap-4 mb-6">
        <Image src={rabbitLogo} className="w-16 h-16 rounded-full" mode="aspectFit" />
        <View className="flex-1">
          <Text className="block text-xl font-bold text-foreground">{displayName}</Text>
          {subTitle && (
            <Text className="block text-sm text-muted-foreground mt-1">{subTitle}</Text>
          )}
        </View>
      </View>

      {/* 角色切换 */}
      {(() => {
        const showParent = roles.some((r) => r.role_type === 'parent') && children.length > 0
        const filteredRoles = roles.filter((r) => r.role_type !== 'parent' || showParent)
        return filteredRoles.length > 1 && (
          <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-foreground mb-3">切换角色</Text>
              <View className="space-y-2">
                {filteredRoles.map((role) => {
                  const roleIndex = roles.findIndex((r) => r.id === role.id)
                  const iconInfo = getRoleIcon(role.role_type)
                  const isActive = roleIndex === currentRoleIndex
                return (
                  <View
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-secondary' : ''}`}
                    onClick={() => setCurrentRole(roleIndex)}
                  >
                    {iconInfo.type === 'image' ? (
                      <Image src={iconInfo.src} className="w-5 h-5 rounded-full" mode="aspectFit" />
                    ) : (
                      <iconInfo.component size={18} color={isActive ? '#E8651A' : '#666'} />
                    )}
                    <Text className={`flex-1 text-sm ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                      {getRoleName(role.role_type)} {role.real_name ? `(${role.real_name})` : ''}
                    </Text>
                    {isActive && (
                      <View className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </View>
                )
              })}
            </View>
            </CardContent>
          </Card>
        )
      })()}

    {/* 我的孩子（家长端） */}
    {currentRole?.role_type === 'parent' && children.length > 0 && (
        <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-foreground mb-3">我的孩子</Text>
            <View className="space-y-2">
              {children.map((child) => (
                <View key={child.id} className="flex items-center gap-3 p-2">
                  <View className="flex-1">
                    <Text className="block text-sm text-foreground">{child.name}</Text>
                    <Text className="block text-xs text-muted-foreground">{child.gender === 'male' ? '男' : child.gender === 'female' ? '女' : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {/* 功能菜单 */}
      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-0">
          <View
            className="flex items-center justify-between p-4"
            onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}
          >
            <Text className="text-sm text-foreground">绑定幼儿并创建家长端</Text>
            <ChevronRight size={16} color="#999" />
          </View>
          <Separator />
          {currentRole?.role_type === 'superadmin' && (
            <>
              <View
                className="flex items-center justify-between p-4"
                onClick={() => Taro.navigateTo({ url: '/pages/admin/permission/index' })}
              >
                <Text className="text-sm text-foreground">权限管理</Text>
                <ChevronRight size={16} color="#999" />
              </View>
              <Separator />
              <View
                className="flex items-center justify-between p-4"
                onClick={() => Taro.navigateTo({ url: '/pages/admin/audit-logs/index' })}
              >
                <Text className="text-sm text-foreground">操作日志</Text>
                <ChevronRight size={16} color="#999" />
              </View>
              <Separator />
            </>
          )}
          <View className="flex items-center justify-between p-4">
            <Text className="text-sm text-foreground">关于力高稚家</Text>
            <ChevronRight size={16} color="#999" />
          </View>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Button
        variant="outline"
        className="w-full rounded-xl border-border text-muted-foreground"
        onClick={() => {
          logout()
          Taro.switchTab({ url: '/pages/index/index' })
        }}
      >
        <LogOut size={16} className="mr-2" color="#666" />
        <Text>退出登录</Text>
      </Button>
      <TabBar />
    </View>
  )
}