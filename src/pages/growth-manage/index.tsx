import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app'
import { childrenApi, growthApi } from '@/utils/api'
import { Pencil, Trash2 } from 'lucide-react-taro'

interface GrowthRecord {
  id: string
  child_id: string
  child_name: string
  title: string
  content: string | null
  photo_urls: string[] | null
  created_at: string
  teacher_name: string
}

const extractList = (res: any): any[] => {
  const data = res?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function GrowthManagePage() {
  const currentRole = useAppStore((s) => s.currentRole)
  const isAdmin = currentRole?.role_type === 'admin' || currentRole?.role_type === 'superadmin'

  const [children, setChildren] = useState<any[]>([])
  const [filterChildId, setFilterChildId] = useState('')
  const [records, setRecords] = useState<GrowthRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChildren()
  }, [])

  useEffect(() => {
    loadRecords()
  }, [filterChildId, currentRole?.id])

  const loadChildren = async () => {
    try {
      const res = await childrenApi.list({ pageSize: 200, status: 'active' })
      setChildren(extractList(res))
    } catch (err) {
      console.error('[GrowthManage] load children error:', err)
    }
  }

  const loadRecords = async () => {
    if (!currentRole?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: any = { page_size: 100, role_id: currentRole.id }
      if (isAdmin && filterChildId) params.child_id = filterChildId
      const res = await growthApi.list(params)
      const data = res?.data
      const list: GrowthRecord[] = data?.list || (Array.isArray(data) ? data : [])
      setRecords(list)
    } catch (err) {
      console.error('[GrowthManage] load records error:', err)
    }
    setLoading(false)
  }

  const goEdit = (id?: string) => {
    Taro.navigateTo({
      url: id ? `/pages/growth-edit/index?id=${id}` : '/pages/growth-edit/index',
    })
  }

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '删除确认',
      content: '确定删除这条记录吗？相关图片也会一并删除。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await growthApi.remove(id, currentRole?.id)
            Taro.showToast({ title: '已删除', icon: 'success' })
            loadRecords()
          } catch (err) {
            console.error('[GrowthManage] delete error:', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-background pb-28">
      {isAdmin && (
        <View className="px-4 pt-3">
          <ScrollView scrollX className="whitespace-nowrap">
            <View className="inline-flex gap-2">
              <Badge
                className={filterChildId === '' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}
                onClick={() => setFilterChildId('')}
              >
                <Text className="text-sm">全部</Text>
              </Badge>
              {children.map((c) => (
                <Badge
                  key={c.id}
                  className={filterChildId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}
                  onClick={() => setFilterChildId(c.id)}
                >
                  <Text className="text-sm">{c.name}</Text>
                </Badge>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View className="p-4">
        {loading ? (
          <Text className="block text-sm text-muted-foreground text-center py-12">加载中...</Text>
        ) : records.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Text className="block text-base text-muted-foreground">暂无成长记录</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {records.map((record) => (
              <Card key={record.id}>
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-2">
                      <Text className="text-sm font-medium text-primary">
                        {record.child_name || '幼儿'}
                      </Text>
                      {record.teacher_name && (
                        <Text className="text-xs text-muted-foreground">{record.teacher_name}</Text>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(record.created_at)}
                    </Text>
                  </View>
                  <Text className="block text-base font-semibold text-foreground mb-1">
                    {record.title}
                  </Text>
                  {record.content && (
                    <Text className="block text-sm text-gray-600 mb-2">{record.content}</Text>
                  )}
                  {record.photo_urls && record.photo_urls.length > 0 && (
                    <View className="flex flex-wrap gap-2 mt-2">
                      {record.photo_urls.map((url, idx) => (
                        <Image
                          key={idx}
                          src={url}
                          className="w-20 h-20 rounded-lg"
                          mode="aspectFill"
                          onClick={() =>
                            Taro.previewImage({ urls: record.photo_urls as string[], current: url })
                          }
                        />
                      ))}
                    </View>
                  )}
                  <View className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => goEdit(record.id)}>
                      <Pencil size={14} color="#E8651A" />
                      <Text className="text-primary text-sm">编辑</Text>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id)}>
                      <Trash2 size={14} color="#ef4444" />
                      <Text className="text-red-500 text-sm">删除</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          zIndex: 100,
        }}
      >
        <Button className="w-full" onClick={() => goEdit()}>
          <Text className="text-white">新增记录</Text>
        </Button>
      </View>
    </View>
  )
}