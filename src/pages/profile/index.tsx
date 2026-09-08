import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Separator } from '@/components/ui/separator'
import { useAppStore, type RoleType } from '@/store/app'
import { authApi } from '@/utils/api'
import { getRelationshipLabel } from '@/utils/helpers'
import { User, ChevronRight, LogOut, Users, Shield, ShieldCheck, Pencil } from 'lucide-react-taro'
import rabbitLogo from '@/assets/rabbit-logo.png'
import TabBar from '@/components/tab-bar'

export default function ProfilePage() {
  const {
    nickname, roles, currentRole, currentRoleIndex, agentOriginalRoleType,
    children, currentChildIndex, isLoggedIn, setCurrentRole, logout, fetchUserInfo, phone,
  } = useAppStore()

  const currentChild = children[currentChildIndex] || null

  // 个人信息维护弹窗
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({ nickname: '', phone: '' })
  const [originalProfilePhone, setOriginalProfilePhone] = useState('')

  const openProfile = () => {
    const roleType = currentRole?.role_type || ''
    const storeNick = nickname || ''
    const roleRealName = currentRole?.real_name || ''
    let prefillNick = ''
    if (roleType === 'teacher') {
      prefillNick = storeNick || roleRealName
    } else if (roleType === 'admin' || roleType === 'superadmin') {
      prefillNick = roleRealName || storeNick
    } else {
      prefillNick = storeNick
    }
    setProfileForm({ nickname: (prefillNick || ''), phone: (phone || '') })
    setOriginalProfilePhone(String(phone || ''))
    setProfileOpen(true)
  }

  const saveProfile = async () => {
    const roleType = currentRole?.role_type || ''
    if (!profileForm.nickname.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    const newPhone = String(profileForm.phone || '').trim()
    const doSaveProfile = async () => {
      try {
      const res = await authApi.updateProfile({
        nickname: profileForm.nickname.trim(),
        phone: String(profileForm.phone || '').trim(),
        role_type: roleType,
      })
      console.log('[Profile] updateProfile response:', res.data)
      const body = (res as any).data
      if (body?.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setProfileOpen(false)
        await fetchUserInfo()
      } else {
        Taro.showToast({ title: body?.msg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Profile] updateProfile error:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
    }
    if (newPhone && originalProfilePhone !== newPhone) {
      Taro.showModal({
        title: '修改手机号',
        content: `手机号将修改为 ${newPhone}`,
        confirmText: '确认修改',
        success: (r) => { if (r.confirm) { doSaveProfile() } },
      })
      return
    }
    doSaveProfile()
  }

  // 根据角色计算显示名称
  const getDisplayName = () => {
    if (!currentRole) return nickname || '用户'
    switch (currentRole.role_type) {
      case 'parent':
        // 管理员/超管代理进入家长端时，显示本人用户名
        if (agentOriginalRoleType === 'admin' || agentOriginalRoleType === 'superadmin') {
          return nickname || '管理员'
        }
        if (currentChild) {
          // 已设置自定义用户名时优先展示，否则展示 幼儿名+关系
          if (nickname && nickname.trim() && nickname !== '新用户') {
            return nickname
          }
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
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={openProfile}
        >
          <Pencil size={14} color="#666" className="mr-1" />
          <Text className="text-sm text-muted-foreground">编辑</Text>
        </Button>
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
                  <View className="flex-1 flex items-center gap-2">
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

      {/* 个人信息维护弹窗 */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">个人信息</DialogTitle>
          </DialogHeader>
          <View className="space-y-4 mt-4">
            <View>
              <Label>用户名</Label>
              <Input
                value={profileForm.nickname}
                onInput={(e) => setProfileForm(prev => ({ ...prev, nickname: e.detail.value }))}
                placeholder="请输入用户名"
              />
            </View>
            <View>
              <Label>手机号</Label>
              <Input
                value={profileForm.phone}
                onInput={(e) => setProfileForm(prev => ({ ...prev, phone: String(e.detail.value || '') }))}
                placeholder="请输入手机号"
                type="number"
              />
            </View>
          </View>
          <View className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setProfileOpen(false)}
            >
              <Text>取消</Text>
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground"
              onClick={saveProfile}
            >
              <Text>保存</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <TabBar />
    </View>
  )
}