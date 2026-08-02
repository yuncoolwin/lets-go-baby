import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Network } from '@/network'
import { Calendar, Sun, Briefcase, Plus, Trash2 } from 'lucide-react-taro'

interface HolidayRecord {
  id: string
  date: string
  type: 'holiday' | 'work_weekend'
  name: string
  year: number
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [availableYears, setAvailableYears] = useState<number[]>([])

  const loadHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/holidays?year=${year}` })
      console.log('[节假日] 加载数据:', res.data)
      if (res.data?.code === 200) {
        setHolidays(res.data.data || [])
      }
    } catch (err) {
      console.error('[节假日] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [year])

  const loadYears = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/holidays/years' })
      console.log('[节假日] 可用年份:', res.data)
      if (res.data?.code === 200) {
        setAvailableYears(res.data.data || [])
      }
    } catch (err) {
      console.error('[节假日] 加载年份失败:', err)
    }
  }, [])

  const handleDeleteYear = async () => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除${year}年的所有节假日数据吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const delRes = await Network.request({ url: `/api/holidays/${year}`, method: 'DELETE' })
            console.log('[节假日] 删除结果:', delRes.data)
            if (delRes.data?.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              setHolidays([])
              loadYears()
            }
          } catch (err) {
            console.error('[节假日] 删除失败:', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleAddYear = async () => {
    const yearNum = parseInt(newYear, 10)
    if (!yearNum || yearNum < 2020 || yearNum > 2100) {
      Taro.showToast({ title: '请输入有效年份（2020-2100）', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '添加中...' })
    try {
      const res = await Network.request({ url: `/api/holidays/update/${yearNum}`, method: 'POST' })
      console.log('[节假日] 添加结果:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: `添加成功，共${res.data.data.count}条`, icon: 'success' })
        setShowAddDialog(false)
        setNewYear('')
        setYear(yearNum)
        loadYears()
      } else {
        Taro.showToast({ title: res.data?.msg || '暂无该年份数据', icon: 'none' })
      }
    } catch (err) {
      console.error('[节假日] 添加失败:', err)
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  useEffect(() => { loadYears() }, [])
  useEffect(() => { loadHolidays() }, [loadHolidays])

  // 按月份分组
  const grouped = holidays.reduce<Record<number, HolidayRecord[]>>((acc, h) => {
    const month = parseInt(h.date.split('-')[1], 10)
    if (!acc[month]) acc[month] = []
    acc[month].push(h)
    return acc
  }, {})

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+08:00')
    const names = ['日', '一', '二', '三', '四', '五', '六']
    return '周' + names[d.getDay()]
  }

  // 构建年份标签列表
  const allYearTabs = [...new Set([...availableYears, 2024, 2025, 2026].sort())]

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部操作栏 */}
      <View style={{ position: 'sticky', top: 0, zIndex: 10 }} className="bg-background px-4 pt-4 pb-2">
        {/* 年份标签 */}
        <View className="flex items-center gap-2 mt-3 overflow-x-auto">
          {allYearTabs.map(y => (
            <View
              key={y}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm whitespace-nowrap
                ${y === year ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setYear(y)}
            >
              <Text className="block">{y}年</Text>
              {y === year && (
                <Trash2 size={12} color={y === year ? '#fff' : '#999'} onClick={e => { e.stopPropagation(); handleDeleteYear() }} />
              )}
            </View>
          ))}
          {/* 添加年份按钮 */}
          <View
            className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-50 border border-dashed border-gray-300 text-gray-500 whitespace-nowrap"
            onClick={() => { setNewYear(''); setShowAddDialog(true) }}
          >
            <Plus size={14} color="#999" />
            <Text className="block">添加年份</Text>
          </View>
        </View>

        {/* 图例 */}
        <View className="flex items-center gap-4 mt-3">
          <View className="flex items-center gap-1">
            <View className="w-3 h-3 rounded-sm bg-red-100" />
            <Text className="text-xs text-gray-500">节假日</Text>
          </View>
          <View className="flex items-center gap-1">
            <View className="w-3 h-3 rounded-sm bg-blue-100" />
            <Text className="text-xs text-gray-500">补班日</Text>
          </View>
          <View className="flex-1" />
          {holidays.length > 0 && (
            <Text className="text-xs text-gray-400">共{holidays.length}条记录</Text>
          )}
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-6" scrollY>
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : holidays.length === 0 ? (
          <View className="flex items-center justify-center py-20">
            <Calendar size={40} color="#d1d5db" />
            <Text className="block text-sm text-gray-400 mt-2">
              {year}年暂无节假日数据
            </Text>
            <Text className="block text-xs text-gray-300 mt-1">
              点击右上角{'\u201C'}更新{'\u201D'}获取
            </Text>
          </View>
        ) : (
          Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map(monthStr => {
            const month = Number(monthStr)
            const items = grouped[month]
            return (
              <View key={month} className="mb-4">
                <Text className="block text-base font-semibold text-foreground mb-2">{MONTH_NAMES[month - 1]}</Text>
                <Card className="bg-white rounded-xl border-0 shadow-sm">
                  <CardContent className="p-0">
                    {items
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((h, idx) => {
                        const isHoliday = h.type === 'holiday'
                        return (
                          <View key={h.id}>
                            {idx > 0 && <View className="h-px bg-gray-50 mx-4" />}
                            <View className="flex items-center gap-3 px-4 py-3">
                              <View className={`w-8 h-8 rounded-full flex items-center justify-center ${isHoliday ? 'bg-red-50' : 'bg-blue-50'}`}>
                                {isHoliday ? (
                                  <Sun size={16} color="#ef4444" />
                                ) : (
                                  <Briefcase size={16} color="#3b82f6" />
                                )}
                              </View>
                              <View className="flex-1">
                                <View className="flex items-center gap-2">
                                  <Text className="block text-sm font-medium text-foreground">{h.name}</Text>
                                  <View className={`px-1 py-1 rounded text-xs ${isHoliday ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                    <Text className="block">{isHoliday ? '节假日' : '补班日'}</Text>
                                  </View>
                                </View>
                                <Text className="block text-xs text-gray-400 mt-1">
                                  {h.date} {getDayOfWeek(h.date)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                  </CardContent>
                </Card>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* 添加年份弹窗 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-sm mx-auto">
          <Text className="block text-lg font-semibold text-foreground text-center mb-4">添加年份</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
            <Input
              className="w-full text-base text-center"
              type="number"
              placeholder="请输入年份（如2027）"
              value={newYear}
              onInput={(e) => setNewYear(e.detail.value)}
            />
          </View>
          <View className="flex items-center gap-3">
            <View className="flex-1">
              <Button className="w-full bg-gray-100 text-gray-600 rounded-xl" onClick={() => setShowAddDialog(false)}>
                <Text className="block">取消</Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button className="w-full bg-primary text-primary-foreground rounded-xl" onClick={handleAddYear}>
                <Text className="block">添加</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}