import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  display_name: string | null
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

const getRoleWeight = (roleType: string) => {
  switch (roleType) {
    case 'superadmin': return 4
    case 'admin': return 3
    case 'teacher': return 2
    case 'parent': return 1
    default: return 0
  }
}

const sortRoles = (roles: RoleItem[]) =>
  [...roles].sort((a, b) => getRoleWeight(b.role_type) - getRoleWeight(a.role_type))

export default function PermissionPage() {
  const userId = useAppStore((s) => s.userId)
  const currentRole = useAppStore((s) => s.currentRole)

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [dialogUserId, setDialogUserId] = useState<string | null>(null)
  const [dialogNickname, setDialogNickname] = useState('')
  const [dialogPhone, setDialogPhone] = useState('')
  const [dialogRoles, setDialogRoles] = useState<RoleItem[]>([])

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
      const url = '/api/admin/permission/assign'
      const res = await Network.request({
        url,
        method: 'POST',
        data: { operator_user_id: userId, user_id: targetUserId, role_type: roleType },
      })
      console.log('[权限管理] POST', url, { operator_user_id: userId, user_id: targetUserId, role_type: roleType }, '->', res.data)
      if (res.data?.code === 200) {
        const msg = res.data?.msg === 'success' ? '已分配' : (res.data?.msg || '已分配')
        Taro.showToast({ title: msg, icon: res.data?.msg === 'success' ? 'success' : 'none' })
        if (dialogMode === 'edit' && dialogUserId === targetUserId) {
          const created = res.data?.data
          if (created?.id && created?.role_type) {
            setDialogRoles((prev) =>
              prev.some((r) => r.id === created.id) ? prev : sortRoles([...prev, created]),
            )
          }
        }
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
      const url = '/api/admin/permission/revoke'
      const res = await Network.request({
        url,
        method: 'POST',
        data: { operator_user_id: userId, user_role_id: roleId },
      })
      console.log('[权限管理] POST', url, { operator_user_id: userId, user_role_id: roleId }, '->', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已撤销', icon: 'success' })
        if (dialogMode === 'edit') {
          setDialogRoles((prev) => prev.filter((r) => r.id !== roleId))
        }
        loadUsers()
      } else {
        Taro.showToast({ title: res.data?.msg || '撤销失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[权限管理] 撤销失败:', err)
      Taro.showToast({ title: '撤销失败', icon: 'none' })
    }
  }

  const openCreateDialog = () => {
    setDialogMode('create')
    setDialogUserId(null)
    setDialogNickname('')
    setDialogPhone('')
    setDialogRoles([])
    setShowDialog(true)
  }

  const openEditDialog = (user: UserItem) => {
    setDialogMode('edit')
    setDialogUserId(user.id)
    setDialogNickname(user.display_name || user.nickname || '')
    setDialogPhone(user.phone || '')
    setDialogRoles(user.roles || [])
    setShowDialog(true)
  }

  const handleDialogConfirm = async () => {
    if (!userId) return
    if (!dialogNickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    const isEdit = dialogMode === 'edit' && dialogUserId
    const url = isEdit ? `/api/admin/permission/user/${dialogUserId}` : '/api/admin/permission/user'
    const method = isEdit ? 'PUT' : 'POST'
    try {
      const res = await Network.request({
        url,
        method,
        data: { operator_user_id: userId, nickname: dialogNickname.trim(), phone: dialogPhone.trim() },
      })
      console.log('[权限管理]', method, url, { operator_user_id: userId, nickname: dialogNickname, phone: dialogPhone }, '->', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: isEdit ? '已更新' : '已新增', icon: 'success' })
        setShowDialog(false)
        loadUsers()
      } else {
        Taro.showToast({ title: res.data?.msg || res.data?.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[权限管理] 保存失败:', err)
      Taro.showToast({ title: (err as any)?.message || '操作失败', icon: 'none' })
    }
  }

  const handleDelete = (user: UserItem) => {
    if (!userId) return
    Taro.showModal({
      title: '确认删除',
      content: `确认删除用户「${user.display_name || user.nickname || '未命名'}」？`,
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const url = `/api/admin/permission/user/${user.id}`
          const r = await Network.request({ url, method: 'DELETE', data: { operator_user_id: userId } })
          console.log('[权限管理] DELETE', url, { operator_user_id: userId }, '->', r.data)
          if (r.data?.code === 200) {
            Taro.showToast({ title: '已删除', icon: 'success' })
            loadUsers()
          } else {
            Taro.showToast({ title: r.data?.msg || '删除失败', icon: 'none' })
          }
        } catch (err) {
          console.error('[权限管理] 删除失败:', err)
          Taro.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  }

  const filteredUsers = users.filter((user) => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return true
    const name = (user.display_name || user.nickname || '').toLowerCase()
    const phone = user.phone || ''
    return name.includes(kw) || phone.includes(kw)
  })

  return (
    <View className="min-h-screen bg-background">
      <ScrollView className="h-screen" scrollY>
        <View className="px-4 pt-4 pb-28 space-y-3">
          <Text className="block text-lg font-bold text-foreground">权限管理</Text>

          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent"
              placeholder="搜索昵称/手机号"
              value={searchKeyword}
              onInput={(e) => setSearchKeyword(e.detail.value)}
            />
          </View>

          <Text className="block text-sm text-muted-foreground">
            共 {filteredUsers.length} 位用户
          </Text>

          {loading ? (
            <View className="flex items-center justify-center py-20">
              <Text className="block text-sm text-gray-400">加载中...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-20">
              <ShieldCheck size={48} color="#d1d5db" />
              <Text className="block text-sm text-gray-400 mt-3">{users.length === 0 ? '暂无用户' : '无匹配用户'}</Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="bg-white rounded-xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <View className="flex items-start justify-between mb-2">
                    <View className="flex-1 min-w-0 mr-2">
                      <Text className="block text-base font-medium text-foreground truncate">
                        {user.display_name || user.nickname || '未命名'}
                      </Text>
                      <Text className="block text-sm text-muted-foreground mt-1">
                        {user.phone || '未绑定手机号'}
                      </Text>
                    </View>
                    <View className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditDialog(user)}>编辑</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={() => handleDelete(user)}>删除</Button>
                    </View>
                  </View>

                  {/* 当前角色（只读展示） */}
                  <View className="flex flex-wrap items-center gap-2 mb-3">
                    {user.roles.length === 0 ? (
                      <Text className="block text-xs text-gray-400">暂无角色</Text>
                    ) : (
                      sortRoles(user.roles).map((role) => (
                        <Badge key={role.id} className={`${getRoleColor(role.role_type)} border-transparent`}>
                          {getRoleLabel(role.role_type)}
                        </Badge>
                      ))
                    )}
                  </View>

                  </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* 底部固定操作栏 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #f0f0f0',
          padding: '12px 16px', zIndex: 100
        }}
      >
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={openCreateDialog}
        >
          <Text className="text-white">新增用户</Text>
        </Button>
      </View>

      {/* 新增/编辑用户弹窗 */}
      {showDialog && (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setShowDialog(false)}
        >
          <View
            className="w-4/5 max-w-sm bg-white rounded-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-base font-semibold text-foreground mb-4">
              {dialogMode === 'edit' ? '编辑用户' : '新增用户'}
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
              <Input
                className="w-full bg-transparent"
                placeholder="用户名"
                value={dialogNickname}
                onInput={(e) => setDialogNickname(e.detail.value)}
              />
            </View>
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
              <Input
                className="w-full bg-transparent"
                placeholder="手机号"
                type="number"
                maxlength={11}
                value={dialogPhone}
                onInput={(e) => setDialogPhone(e.detail.value)}
              />
            </View>
            {dialogMode === 'edit' && (
              <View className="mb-5">
                <Text className="block text-sm font-medium text-foreground mb-2">角色分配</Text>
                <View className="flex flex-wrap items-center gap-2 mb-3">
                  {dialogRoles.length === 0 ? (
                    <Text className="block text-xs text-gray-400">暂无角色</Text>
                  ) : (
                    sortRoles(dialogRoles).map((role) => (
                      <View key={role.id} className="flex items-center gap-1">
                        <Badge className={`${getRoleColor(role.role_type)} border-transparent`}>
                          {getRoleLabel(role.role_type)}
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
                <View className="flex flex-wrap items-center gap-2">
                  {ASSIGN_ROLE_TYPES.map((rt) => (
                    <Button
                      key={rt.value}
                      size="sm"
                      variant="outline"
                      className="px-3 h-8"
                      onClick={() => dialogUserId && handleAssign(dialogUserId, rt.value)}
                    >
                      {rt.label}
                    </Button>
                  ))}
                </View>
              </View>
            )}
            <View className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>取消</Button>
              <Button className="flex-1" onClick={handleDialogConfirm}>确认</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}