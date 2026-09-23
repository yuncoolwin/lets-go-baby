import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Copy } from 'lucide-react-taro'
import { useAppStore } from '@/store/app'
import { useShareMessage } from '@/hooks/useShare'
import { Network } from '@/network'

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
  useShareMessage()
  const [drafts, setDrafts] = useState<GrowthDraft[]>(loadDrafts())
  const isAgentAdmin = useAppStore((s) => s.agentOriginalRoleType === 'admin')

  // 重签后 URL（draftId -> 解析后的 URL，仅用于渲染，不改本地草稿结构）
  const [draftMedia, setDraftMedia] = useState<Record<string, string[]>>({})
  // 加载失败/不可重签的缩略图（draftId-idx -> boolean），渲染灰色占位
  const [failedImgs, setFailedImgs] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    const resign = async () => {
      try {
        const local = loadDrafts()
        const map: Record<string, string[]> = {}
        for (const d of local) {
          const urls = d.photo_urls || []
          if (!urls.length) continue
          let resolved: string[] = urls
          try {
            const res = await Network.request({
              url: '/api/growth-records/sign-urls',
              method: 'POST',
              data: { photo_urls: urls },
            })
            const list = res.data?.data?.urls
            if (Array.isArray(list) && list.length) resolved = list
          } catch {
            // 接口异常降级：保留原 URL，由 onError 兜底占位
          }
          map[d.id] = resolved
        }
        if (!cancelled && Object.keys(map).length) setDraftMedia(map)
      } catch {
        // 忽略：保持初始加载展示
      }
    }
    resign()
    return () => {
      cancelled = true
    }
  }, [])

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
        {!isAgentAdmin && drafts.length > 0 && (
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
            <Card key={draft.id} onClick={() => { if (!isAgentAdmin) goEdit(draft) }}>
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
                  <ScrollView scrollX className="mt-2" style={{ whiteSpace: 'nowrap' }}>
                    <View className="flex gap-2" style={{ display: 'inline-flex' }}>
                      {(draftMedia[draft.id] || draft.photo_urls || []).map((url, idx) => {
                        const imgKey = `${draft.id}-${idx}`
                        const isFailed = failedImgs[imgKey]
                        return isFailed ? (
                          <View
                            key={imgKey}
                            className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"
                          >
                            <Text className="text-xs text-gray-400">图片已失效</Text>
                          </View>
                        ) : (
                          <Image
                            key={imgKey}
                            src={url}
                            className="w-24 h-24 rounded-lg flex-shrink-0"
                            mode="aspectFill"
                            onError={() =>
                              setFailedImgs((prev) => ({ ...prev, [imgKey]: true }))
                            }
                          />
                        )
                      })}
                    </View>
                  </ScrollView>
                )}
                <View className="flex justify-end gap-2 mt-3">
                  {!isAgentAdmin && (
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
                  )}
                  {!isAgentAdmin && (
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
                  )}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}