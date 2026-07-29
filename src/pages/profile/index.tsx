import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type RoleType } from '@/store/app'
import { User, ChevronRight, LogOut, Users, Baby, Shield } from 'lucide-react-taro'

export default function ProfilePage() {
  const {
    nickname, roles, currentRole, currentRoleIndex,
    children, currentChildIndex, isLoggedIn, setCurrentRole, logout,
  } = useAppStore()

  const currentChild = children[currentChildIndex] || null

  // 根据角色计算显示名称
  const getDisplayName = () => {
    if (!currentRole) return nickname || '用户'
    switch (currentRole.role_type) {
      case 'parent':
        if (currentChild) {
          const relMap: Record<string, string> = {
            father: '爸爸', mother: '妈妈',
            grandfather: '爷爷', grandmother: '奶奶',
          }
          const relText = relMap[currentChild.relationship] || '家长'
          return `${currentChild.name}${relText}`
        }
        return nickname || '新用户'
      case 'teacher':
        return currentRole.real_name || '老师'
      case 'admin':
        return '管理员'
      default:
        return nickname || '用户'
    }
  }

  const displayName = getDisplayName()

  const getRoleName = (role: RoleType) => {
    switch (role) {
      case 'parent': return '家长'
      case 'teacher': return '教师'
      case 'admin': return '管理员'
      default: return '未知'
    }
  }

  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case 'parent': return Baby
      case 'teacher': return Users
      case 'admin': return Shield
      default: return User
    }
  }

  if (!isLoggedIn) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Avatar className="w-20 h-20 mb-4">
          <AvatarFallback>
            <User size={32} color="#999999" />
          </AvatarFallback>
        </Avatar>
        <Text className="block text-base text-muted-foreground mb-4">请先登录</Text>
        <Button
          className="bg-primary text-primary-foreground rounded-xl"
          onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
        >
          <Text>去登录</Text>
        </Button>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4">
      {/* 用户信息 */}
      <View className="flex items-center gap-4 mb-6">
        <Avatar className="w-16 h-16">
          <AvatarFallback>
            <Text className="text-lg font-bold text-primary">
              {(displayName || '用')[0]}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="block text-lg font-bold text-foreground">{displayName}</Text>
          {currentRole && (
            <Text className="block text-sm text-primary mt-1">
              {getRoleName(currentRole.role_type)} · {currentRole.real_name || ''}
            </Text>
          )}
        </View>
      </View>

      {/* 角色切换 */}
      {roles.length > 1 && (
        <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-foreground mb-3">切换角色</Text>
            <View className="space-y-2">
              {roles.map((role, index) => {
                const Icon = getRoleIcon(role.role_type)
                const isActive = index === currentRoleIndex
                return (
                  <View
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-secondary' : ''}`}
                    onClick={() => setCurrentRole(index)}
                  >
                    <Icon size={18} color={isActive ? '#E8651A' : '#666'} />
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
      )}

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
                    <Text className="block text-xs text-muted-foreground">{child.relationship}</Text>
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
            <Text className="text-sm text-foreground">绑定幼儿</Text>
            <ChevronRight size={16} color="#999" />
          </View>
          <Separator />
          {currentRole?.role_type === 'admin' && (
            <>
              <View
                className="flex items-center justify-between p-4"
                onClick={() => Taro.navigateTo({ url: '/pages/review/index' })}
              >
                <Text className="text-sm text-foreground">审核管理</Text>
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
    </View>
  )
}
