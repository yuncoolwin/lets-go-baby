import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2 } from 'lucide-react-taro'

const DRAFT_KEY = 'growth_drafts'

interface GrowthDraft {
  id: string
  child_id?: string
  child_name?: string
  course_id?: string
  course_name?: string
  title?: string
  content?: string
  photo_urls?: string[]
  record_date?: string
  updated_at?: string
}

const loadDrafts = (): GrowthDraft[] => {
  try {
    const d = Taro.getStorageSync(DRAFT_KEY)
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

const saveDrafts = (drafts: GrowthDraft[]) => {
  Taro.setStorageSync(DRAFT_KEY, drafts)
}

const formatTime = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function GrowthDraftsPage() {
  const [drafts, setDrafts] = useState<GrowthDraft[]>(loadDrafts())

  const refresh = () => setDrafts(loadDrafts())

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '删除草稿',
      content: '确定删除这条草稿吗？',
      success: (res) => {
        if (res.confirm) {
          saveDrafts(loadDrafts().filter((d) => d.id !== id))
          refresh()
        }
      },
    })
  }

  const handleClearAll = () => {
    Taro.showModal({
      title: '清空全部',
      content: '确定清空所有草稿吗？该操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          saveDrafts([])
          refresh()
        }
      },
    })
  }

  const goEdit = (draft: GrowthDraft) => {
    Taro.navigateTo({ url: `/pages/growth-edit/index?draft_id=${draft.id}` })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="px-4 pt-3 flex items-center justify-between mb-2">
        <Text className="block text-sm text-muted-foreground">共 {drafts.length} 条草稿</Text>
        {drafts.length > 0 && (
          <Text className="text-sm text-red-500" onClick={handleClearAll}>
            清空全部
          </Text>
        )}
      </View>

      {drafts.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-24">
          <Text className="block text-base text-muted-foreground">暂无草稿</Text>
        </View>
      ) : (
        <View className="px-4 space-y-3 pb-8">
          {drafts.map((draft) => (
            <Card key={draft.id} onClick={() => goEdit(draft)}>
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-2">
                  <Text className="text-sm font-medium text-primary">
                    {draft.child_name || '未选择幼儿'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {formatTime(draft.updated_at)}
                  </Text>
                </View>
                {draft.course_name ? (
                  <Text className="block text-xs text-gray-500 mb-2">{draft.course_name}</Text>
                ) : null}
                <View className="flex items-center justify-between">
                  <Text className="block text-base font-semibold text-foreground flex-1 mr-2">
                    {draft.title || '（无标题）'}
                  </Text>
                  <View
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(draft.id)
                    }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}