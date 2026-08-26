import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Copy } from 'lucide-react-taro'

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

  const handleCopy = (draft: GrowthDraft) => {
    const newDraft: GrowthDraft = {
      ...draft,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      updated_at: new Date().toISOString(),
    }
    saveDrafts([newDraft, ...loadDrafts()])
    refresh()
    Taro.showToast({ title: '已复制草稿', icon: 'success' })
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
                <View className="flex items-center justify-between mb-1">
                  <Text className="text-base font-semibold text-foreground flex-1 min-w-0">
                    {draft.title || '（无标题）'}
                  </Text>
                  {draft.course_name ? (
                    <Text className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                      {draft.course_name}
                    </Text>
                  ) : null}
                </View>
                {draft.content ? (
                  <Text
                    className="block text-sm text-gray-600 mb-2"
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {draft.content}
                  </Text>
                ) : null}
                {draft.photo_urls && draft.photo_urls.length > 0 && (
                  <View className="flex gap-2 mt-2 overflow-x-auto">
                    {draft.photo_urls.map((url, idx) => (
                      <Image
                        key={idx}
                        src={url}
                        className="w-20 h-20 rounded-lg flex-shrink-0"
                        mode="aspectFill"
                      />
                    ))}
                  </View>
                )}
                <View className="flex justify-end gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(draft)
                    }}
                  >
                    <Copy size={14} color="#E8651A" />
                    <Text className="text-primary text-sm">复制</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(draft.id)
                    }}
                  >
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
  )
}