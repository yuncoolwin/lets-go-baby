import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { Calendar } from 'lucide-react-taro'

interface StatutoryHoliday {
  id: string
  date: string
  type: 'holiday' | 'work_weekend'
  name: string
  year: number
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function StatutoryHolidaysPage() {
  const [holidays, setHolidays] = useState<StatutoryHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState<number[]>([])

  const loadHolidays = useCallback(async (targetYear: number) => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/statutory-holidays?year=${targetYear}`, method: 'GET' })
      console.log('[法定节假日] 加载数据:', res.data)
      if (res.data?.code === 200) {
        setHolidays(res.data.data || [])
      }
    } catch (err) {
      console.error('[法定节假日] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadYears = useCallback(async () => {
    try {
      const res = await Network.request({ url: '/api/statutory-holidays/years', method: 'GET' })
      console.log('[法定节假日] 年份列表:', res.data)
      if (res.data?.code === 200) {
        setYears(res.data.data || [])
      }
    } catch (err) {
      console.error('[法定节假日] 加载年份失败:', err)
    }
  }, [])

  useDidShow(() => {
    loadYears()
    loadHolidays(year)
  })

  const switchYear = (y: number) => {
    setYear(y)
    loadHolidays(y)
  }

  // 按月份分组
  const groupedByMonth: Record<number, StatutoryHoliday[]> = {}
  holidays.forEach((h) => {
    const month = parseInt(h.date.split('-')[1], 10)
    if (!groupedByMonth[month]) groupedByMonth[month] = []
    groupedByMonth[month].push(h)
  })

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m, 10)}月${parseInt(d, 10)}日`
  }

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+08:00')
    const names = ['日', '一', '二', '三', '四', '五', '六']
    return '周' + names[d.getDay()]
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 年份切换 */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex items-center gap-2 overflow-x-auto">
          {years.map((y) => (
            <View
              key={y}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap ${
                year === y ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => switchYear(y)}
            >
              <Text className="block text-sm">{y}年</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-6" scrollY>
        {loading ? (
          <View className="flex items-center justify-center py-20">
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : holidays.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Calendar size={48} color="#d1d5db" />
            <Text className="block text-sm text-gray-400 mt-3">暂无法定节假日数据</Text>
          </View>
        ) : (
          <View className="space-y-4">
            {Object.entries(groupedByMonth).map(([monthStr, items]) => {
              const month = parseInt(monthStr, 10)
              const holidayCount = items.filter(h => h.type === 'holiday').length
              const workWeekendCount = items.filter(h => h.type === 'work_weekend').length
              return (
                <Card key={month} className="bg-white rounded-xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <View className="mb-3">
                      <Text className="block text-base font-semibold text-foreground">
                        {MONTH_NAMES[month - 1]}
                      </Text>
                      <Text className="block text-xs text-muted-foreground mt-1">
                        放假 {holidayCount} 天
                        {workWeekendCount > 0 && ` · 调休 ${workWeekendCount} 天`}
                      </Text>
                    </View>
                    <View className="space-y-2">
                      {items.map((h) => (
                        <View key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <View className="flex items-center gap-2 flex-1">
                            <View
                              className={`w-2 h-2 rounded-full ${
                                h.type === 'holiday' ? 'bg-green-500' : 'bg-orange-400'
                              }`}
                            />
                            <Text className="block text-sm text-foreground">
                              {formatDate(h.date)} {getDayOfWeek(h.date)} {h.name}
                            </Text>
                          </View>
                          <View
                            className={`px-2 py-1 rounded-full text-xs ${
                              h.type === 'holiday'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-orange-50 text-orange-600'
                            }`}
                          >
                            <Text className="text-xs">
                              {h.type === 'holiday' ? '放假' : '调休'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </CardContent>
                </Card>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}