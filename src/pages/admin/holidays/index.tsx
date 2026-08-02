import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { RefreshCw, Calendar, Sun, Briefcase } from 'lucide-react-taro'

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
  const [updating, setUpdating] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())

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

  const handleUpdate = async () => {
    Taro.showLoading({ title: '更新中...' })
    setUpdating(true)
    try {
      const res = await Network.request({ url: '/api/holidays/update', method: 'POST' })
      console.log('[节假日] 更新结果:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: `更新成功，共${res.data.data.count}条`, icon: 'success' })
        loadHolidays()
      } else {
        Taro.showToast({ title: '更新失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[节假日] 更新失败:', err)
      Taro.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      setUpdating(false)
      Taro.hideLoading()
    }
  }

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

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部操作栏 */}
      <View style={{ position: 'sticky', top: 0, zIndex: 10 }} className="bg-background px-4 pt-4 pb-2">
        <Button
          className="w-full bg-primary text-primary-foreground rounded-xl"
          onClick={handleUpdate}
          disabled={updating}
        >
          <RefreshCw size={16} className="mr-2" color="#fff" />
          <Text>{updating ? '更新中...' : '更新节假日信息'}</Text>
        </Button>

        {/* 年份选择 */}
        <View className="flex items-center gap-2 mt-3">
          {[2025, 2026, 2027].map(y => (
            <View
              key={y}
              className={`px-4 py-1 rounded-full text-sm ${y === year ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setYear(y)}
            >
              <Text className="block">{y}年</Text>
            </View>
          ))}
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
            <Text className="block text-sm text-gray-400 mt-2">暂无节假日数据</Text>
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
    </View>
  )
}