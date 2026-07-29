import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { UserPlus, Copy, CircleCheck, Users } from 'lucide-react-taro'

interface Teacher {
  id: string
  real_name: string
  class_name: string
  phone: string
  status: string
}

export default function TeacherManagePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTeachers()
  }, [])

  const loadTeachers = async () => {
    setLoading(true)
    try {
      // Demo data
      setTeachers([
        { id: '1', real_name: '王老师', class_name: '向日葵班', phone: '138****1234', status: 'active' },
        { id: '2', real_name: '李老师', class_name: '小星星班', phone: '139****5678', status: 'active' },
        { id: '3', real_name: '张老师', class_name: '月亮班', phone: '137****9012', status: 'active' },
      ])
    } catch (err) {
      console.error('[TeacherManage] error:', err)
    }
    setLoading(false)
  }

  const handleGenerateInviteCode = async () => {
    setGenerating(true)
    try {
      const res = await Network.request({
        url: '/api/auth/generate-invite-code',
        method: 'POST',
        data: { admin_role_id: 'demo-admin' }
      })
      console.log('[TeacherManage] invite code:', res.data)
      if (res.data?.data?.invite_code) {
        setInviteCode(res.data.data.invite_code)
      }
    } catch (err) {
      console.error('[TeacherManage] generate error:', err)
    }
    setGenerating(false)
  }

  const handleCopyCode = () => {
    if (!inviteCode) return
    Taro.setClipboardData({
      data: inviteCode,
      success: () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-6 w-32 mb-4 rounded" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      <Text className="block text-lg font-bold text-foreground mb-4">教师管理</Text>

      {/* 邀请码区域 */}
      <Card className="bg-white rounded-xl border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <Text className="block text-sm font-semibold text-foreground mb-3">教师邀请码</Text>
          {inviteCode ? (
            <View>
              <View className="flex items-center gap-2 bg-secondary rounded-lg p-3 mb-3">
                <Text className="flex-1 text-lg font-mono font-bold text-primary text-center">
                  {inviteCode}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <CircleCheck size={18} color="#22C55E" />
                  ) : (
                    <Copy size={18} color="#666" />
                  )}
                </Button>
              </View>
              <Text className="block text-xs text-muted-foreground">
                将此邀请码发送给新教师，教师可在登录页使用邀请码注册
              </Text>
            </View>
          ) : (
            <Button
              className="w-full bg-primary text-primary-foreground rounded-lg"
              onClick={handleGenerateInviteCode}
              disabled={generating}
            >
              <UserPlus size={16} className="mr-2" color="#fff" />
              <Text className="text-sm text-primary-foreground">
                {generating ? '生成中...' : '生成邀请码'}
              </Text>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 教师列表 */}
      <Text className="block text-sm font-semibold text-foreground mb-3">
        教师列表 ({teachers.length})
      </Text>
      <View className="space-y-3">
        {teachers.map((teacher) => (
          <Card key={teacher.id} className="bg-white rounded-xl border-0 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Users size={18} color="#E8651A" />
                </View>
                <View className="flex-1">
                  <Text className="block text-sm font-semibold text-foreground">
                    {teacher.real_name}
                  </Text>
                  <Text className="block text-xs text-muted-foreground mt-1">
                    {teacher.class_name} · {teacher.phone}
                  </Text>
                </View>
                <View className="px-2 py-1 rounded-full bg-green-100">
                  <Text className="text-xs text-green-700">在职</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        ))}
      </View>
    </View>
  )
}
