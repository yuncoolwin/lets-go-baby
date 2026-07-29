import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { ShieldCheck } from 'lucide-react-taro'

interface BindingRequest {
  id: string
  parent_name: string
  child_name: string
  relationship: string
  status: string
  created_at: string
}

export default function ReviewPage() {
  const [requests, setRequests] = useState<BindingRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/admin/binding-requests',
        method: 'GET',
      })
      console.log('[Review] requests:', res.data)
      if (res.data?.data) {
        setRequests(res.data.data)
      }
    } catch (err) {
      console.error('[Review] error:', err)
    }
    setLoading(false)
  }

  const handleApprove = async (requestId: string) => {
    try {
      await Network.request({
        url: '/api/admin/binding-requests/approve',
        method: 'POST',
        data: { request_id: requestId },
      })
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err) {
      console.error('[Review] approve error:', err)
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      await Network.request({
        url: '/api/admin/binding-requests/reject',
        method: 'POST',
        data: { request_id: requestId },
      })
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err) {
      console.error('[Review] reject error:', err)
    }
  }

  const getRelationLabel = (rel: string) => {
    switch (rel) {
      case 'father': return '父亲'
      case 'mother': return '母亲'
      case 'guardian': return '监护人'
      default: return rel
    }
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
    <View className="min-h-screen bg-background p-4">
      <Text className="block text-lg font-bold text-foreground mb-4">绑定审核</Text>

      {requests.length === 0 ? (
        <View className="flex flex-col items-center py-16">
          <ShieldCheck size={48} color="#999999" />
          <Text className="block text-sm text-muted-foreground mt-3">暂无待审核申请</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">{req.child_name}</Text>
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                    <Text className="text-xs">待审核</Text>
                  </Badge>
                </View>
                <View className="space-y-1 mb-3">
                  <Text className="block text-sm text-muted-foreground">
                    申请人: {req.parent_name}
                  </Text>
                  <Text className="block text-sm text-muted-foreground">
                    关系: {getRelationLabel(req.relationship)}
                  </Text>
                  <Text className="block text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleString('zh-CN')}
                  </Text>
                </View>
                <View className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-500 text-white rounded-lg"
                    onClick={() => handleApprove(req.id)}
                  >
                    <Text className="text-white text-xs">通过</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-lg border-red-200 text-red-500"
                    onClick={() => handleReject(req.id)}
                  >
                    <Text className="text-xs">拒绝</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
