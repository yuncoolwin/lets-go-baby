import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import { ShieldCheck } from 'lucide-react-taro'

interface RoleItem {
  id: string
  role_type: string
  real_name: string | null
  status: string
}

interface UserItem {
  id: string
  nickname: string
  phone: string
  avatar_url: string | null
  roles: RoleItem[]
}

const ASSIGN_ROLE_TYPES = [
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
  { value: 'superadmin', label: '超管' },
]

const getRoleLabel = (roleType: string) => {
  switch (roleType) {
    case 'parent': return '家长'
    case 'teacher': return '教师'
    case 'admin': return '管理员'
    case 'superadmin': return '超级管理员'
    default: return roleType
  }
}

const getRoleColor = (roleType: string) => {
  switch (roleType) {
    case 'parent': return 'bg-gray-100 text-gray-700'
    case 'teacher': return 'bg-blue-100 text-blue-700'
    case 'admin': return 'bg-green-100 text-green-700'
    case 'superadmin': return 'bg-purple-100 text-purple-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export default function PermissionPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const url = `/api/admin/permission/users?operator_user_id=${userId}`
      const res = await Network.request({ url, method: 'GET' })
      console.log('[权限管理] GET', url, '->', res.data)
      if (res.data?.code === 200) {
        setUsers(res.data.data || [])
      } else {
        Taro.showToast({ title: res.data?.msg || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[权限管理] 加载失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (currentRole?.role_type !== 'superadmin') {
      Taro.showToast({ title: '无权限', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 800)
    }
  }, [currentRole])

  useDidShow(() => {
    if (currentRole?.role_type === 'superadmin') {
      loadUsers()
    }
  })

  const handleAssign = async (targetUserId: string, roleType: string) => {
    if (!userId) return
    try {
      const res = await Network.request({
        url: '/api/admin/permission/assign',
        method: 'POST',
        data: { operator_user_id: userId, user_id: targetUserId, role_type: roleType },
      })
      console.log('[权限管理] POST /api/admin/permission/assign', { operator_user_id: userId, user_id: targetUserId, role_type: roleType }, '->', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已分配', icon: 'success' })
        loadUsers()
      } else {
        Taro.showToast({ title: res.data?.msg || '分配失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[权限管理] 分配失败:', err)
      Taro.showToast({ title: '分配失败', icon: 'none' })
    }
  }

  const handleRevoke = async (roleId: string) => {
    if (!userId) return
    try {
      const res = await Network.request({
        url: '/api/admin/permission/revoke',
        method: 'POST',
        data: { operator_user_id: userId, user_role_id: roleId },
      })
      console.log('[权限管理] POST /api/admin/permission/revoke', { operator_user_id: userId, user_role_id: roleId }, '->', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已撤销', icon: 'success' })
        loadUsers()
      } else {
        Taro.showToast({ title: res.data?.msg || '撤销失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[权限管理] 撤销失败:', err)
      Taro.showToast({ title: '撤销失败', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-background">
      <ScrollView className="h-screen" scrollY>
        <View className="px-4 pt-4 pb-6 space-y-3">
          <Text className="block text-lg font-bold text-foreground">权限管理</Text>
          <Text className="block text-sm text-muted-foreground">
            共 {users.length} 位用户，可为用户分配或撤销角色
          </Text>

          {loading ? (
            <View className="flex items-center justify-center py-20">
              <Text className="block text-sm text-gray-400">加载中...</Text>
            </View>
          ) : users.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-20">
              <ShieldCheck size={48} color="#d1d5db" />
              <Text className="block text-sm text-gray-400 mt-3">暂无用户</Text>
            </View>
          ) : (
            users.map((user) => (
              <Card key={user.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-start justify-between mb-2">
                    <View className="flex-1 min-w-0">
                      <Text className="block text-base font-medium text-foreground">
                        {user.nickname || '未命名'}
                      </Text>
                      <Text className="block text-sm text-muted-foreground mt-1">
                        {user.phone || '未绑定手机号'}
                      </Text>
                    </View>
                  </View>

                  {/* 当前角色标签 + 撤销 */}
                  <View className="flex flex-wrap items-center gap-2 mb-3">
                    {user.roles.length === 0 ? (
                      <Text className="block text-xs text-gray-400">暂无角色</Text>
                    ) : (
                      user.roles.map((role) => (
                        <View key={role.id} className="flex items-center gap-1">
                          <Badge className={`${getRoleColor(role.role_type)} border-transparent`}>
                            {getRoleLabel(role.role_type)}
                            {role.real_name ? ` · ${role.real_name}` : ''}
                          </Badge>
                          <Text
                            className="block text-xs text-red-500 px-1"
                            onClick={() => handleRevoke(role.id)}
                          >
                            撤销
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  {/* 分配角色 */}
                  <View className="flex flex-wrap items-center gap-2">
                    <Text className="block text-xs text-gray-500 shrink-0">分配角色：</Text>
                    {ASSIGN_ROLE_TYPES.map((rt) => (
                      <Button
                        key={rt.value}
                        size="sm"
                        variant="outline"
                        className="px-3 h-8"
                        onClick={() => handleAssign(user.id, rt.value)}
                      >
                        {rt.label}
                      </Button>
                    ))}
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}