import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/app'
import { Network } from '@/network'
import BackButton from '@/components/back-button'

interface ChildItem {
  id: string
  name: string
  gender: string
  status: string
}

interface AttendanceItem {
  child_id: string
  status: 'present' | 'absent' | 'leave' | 'unknown'
}

const STATUS_CONFIG = {
  present: { label: '到', color: 'bg-green-500', text: 'text-white' },
  absent: { label: '缺', color: 'bg-red-500', text: 'text-white' },
  leave: { label: '假', color: 'bg-yellow-400', text: 'text-yellow-800' },
  unknown: { label: '—', color: 'bg-gray-100', text: 'text-gray-400' },
} as const

export default function RollCallPage() {
  const { currentRole } = useAppStore()
  const [children, setChildren] = useState<ChildItem[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceItem['status']>>({})
  const [classId, setClassId] = useState('')
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [tempAttendance, setTempAttendance] = useState<Record<string, AttendanceItem['status']>>({})

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const teacherId = Taro.getStorageSync('teacherId') || currentRole?.id
      if (!teacherId) {
        setLoading(false)
        return
      }
      
      const teacherRes = await Network.request({
        url: `/api/teachers/${teacherId}`,
      })
      const teacherData = teacherRes.data?.data
      if (!teacherData?.class_id) {
        setLoading(false)
        return
      }
      const theClassId = teacherData.class_id
      setClassId(theClassId)
      setClassName(teacherData.class_name || '')

      const childrenRes = await Network.request({
        url: '/api/children',
        data: { class_id: theClassId, status: 'active', pageSize: 100 },
      })
      const list: ChildItem[] = childrenRes.data?.data?.list || childrenRes.data?.data || []
      setChildren(list)

      const attendanceRes = await Network.request({
        url: '/api/attendance',
        data: { class_id: theClassId, date: today },
      })
      const records: any[] = attendanceRes.data?.data || []
      const map: Record<string, AttendanceItem['status']> = {}
      records.forEach(r => { 
        map[r.child_id] = r.attendance_status || r.status 
      })
      setAttendance(map)
      setTempAttendance(map)
      
      // 如果有考勤记录，自动锁定
      const hasRecords = records.length > 0
      setIsLocked(hasRecords)
    } catch (e) {
      console.error('[RollCall] load error:', e)
    }
    setLoading(false)
  }

  const handleStatusChange = (childId: string, status: AttendanceItem['status']) => {
    if (isLocked) return
    const prev = tempAttendance[childId]
    if (prev === status) return
    setTempAttendance(prevAtt => ({ ...prevAtt, [childId]: status }))
    setHasUnsaved(true)
  }

  const handleSave = async () => {
    try {
      for (const childId of Object.keys(tempAttendance)) {
        const status = tempAttendance[childId]
        if (status === 'unknown') continue
        await Network.request({
          url: '/api/attendance',
          method: 'POST',
          data: {
            child_id: childId,
            class_id: classId,
            date: today,
            status,
            teacher_id: currentRole?.id || '',
          },
        })
      }
      setAttendance(tempAttendance)
      setIsLocked(true)
      setHasUnsaved(false)
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleUnlock = () => {
    if (isLocked) {
      setIsLocked(false)
      setTempAttendance(attendance)
    }
  }

  const handleClear = async () => {
    Taro.showModal({
      title: '确认清除',
      content: `确定要清除 ${className} 今日全部考勤记录吗？`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: '/api/attendance/clear',
              method: 'POST',
              data: { class_id: classId, date: today },
            })
            setAttendance({})
            setTempAttendance({})
            setIsLocked(false)
            setHasUnsaved(false)
            Taro.showToast({ title: '已清除', icon: 'success' })
          } catch (e) {
            Taro.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      },
    })
  }

  const presentCount = Object.values(tempAttendance).filter(s => s === 'present').length
  const absentCount = Object.values(tempAttendance).filter(s => s === 'absent').length
  const leaveCount = Object.values(tempAttendance).filter(s => s === 'leave').length
  const currentDisplay = isLocked ? attendance : tempAttendance

  return (
    <View className="min-h-screen bg-gray-50 pb-safe">
      {/* 头部 */}
      <View className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <BackButton />
        <Text className="block text-lg font-semibold text-gray-900">今日考勤</Text>
        <View className="ml-auto flex items-center gap-2">
          <Text className="block text-sm text-gray-400">{today}</Text>
          <Text 
            className="block text-sm text-red-500 px-2 py-1 rounded"
            onClick={handleClear}
          >
            清除
          </Text>
        </View>
      </View>

      <ScrollView scrollY className="h-[calc(100vh-220px)]">
        {/* 班级信息 */}
        {className && (
          <View className="px-4 pt-4 pb-2">
            <Text className="block text-sm text-gray-500">{className} 在读幼儿</Text>
          </View>
        )}

        {/* 统计 */}
        <View className="px-4 pb-3 flex gap-3">
          <View className="flex-1 bg-green-50 rounded-xl py-2 px-3 text-center">
            <Text className="block text-xl font-bold text-green-600">{presentCount}</Text>
            <Text className="block text-xs text-green-500">出勤</Text>
          </View>
          <View className="flex-1 bg-red-50 rounded-xl py-2 px-3 text-center">
            <Text className="block text-xl font-bold text-red-500">{absentCount}</Text>
            <Text className="block text-xs text-red-400">缺勤</Text>
          </View>
          <View className="flex-1 bg-yellow-50 rounded-xl py-2 px-3 text-center">
            <Text className="block text-xl font-bold text-yellow-600">{leaveCount}</Text>
            <Text className="block text-xs text-yellow-500">请假</Text>
          </View>
          <View className="flex-1 bg-gray-100 rounded-xl py-2 px-3 text-center">
            <Text className="block text-xl font-bold text-gray-400">{children.length - presentCount - absentCount - leaveCount}</Text>
            <Text className="block text-xs text-gray-400">未记录</Text>
          </View>
        </View>

        {/* 幼儿列表 */}
        <View className="px-4 pb-6 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-gray-100 animate-pulse" />
                  <View className="flex-1 space-y-2">
                    <View className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
                    <View className="h-3 bg-gray-100 rounded w-16 animate-pulse" />
                  </View>
                  <View className="flex gap-2">
                    <View className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                    <View className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                    <View className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                  </View>
                </CardContent>
              </Card>
            ))
          ) : children.length === 0 ? (
            <View className="text-center py-12">
              <Text className="block text-gray-400">暂无在读幼儿</Text>
            </View>
          ) : (
            children.map(child => {
              const current = currentDisplay[child.id] || 'unknown'
              return (
                <Card key={child.id}>
                  <CardContent className="p-4">
                    <View className="flex items-center gap-3 mb-3">
                      <View
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          child.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {child.name.charAt(0)}
                      </View>
                      <Text className="block text-base font-medium text-gray-900 flex-1">{child.name}</Text>
                      <View className={`px-2 py-1 rounded text-xs font-medium ${STATUS_CONFIG[current].color} ${STATUS_CONFIG[current].text}`}>
                        <Text className="block text-xs">{STATUS_CONFIG[current].label}</Text>
                      </View>
                    </View>

                    <View className="flex gap-2">
                      {(['present', 'absent', 'leave'] as const).map(status => (
                        <View
                          key={status}
                          className={`flex-1 py-2 rounded-xl text-center font-medium transition-all ${
                            current === status
                              ? `${STATUS_CONFIG[status].color} ${STATUS_CONFIG[status].text}`
                              : 'bg-gray-100 text-gray-500'
                          } ${isLocked ? 'opacity-50' : ''}`}
                          onClick={() => !isLocked && handleStatusChange(child.id, status)}
                        >
                          <Text className={`block text-sm font-medium ${current === status ? STATUS_CONFIG[status].text : 'text-gray-600'}`}>
                            {status === 'present' ? '✓ 到' : status === 'absent' ? '✗ 缺' : '△ 假'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </CardContent>
                </Card>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        {isLocked ? (
          <View 
            className="flex-1 py-3 rounded-xl text-center font-medium bg-blue-500 text-white"
            onClick={handleUnlock}
          >
            <Text className="block text-base font-medium text-white">修改</Text>
          </View>
        ) : (
          <>
            <View 
              className={`flex-1 py-3 rounded-xl text-center font-medium ${
                hasUnsaved 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-400'
              }`}
              onClick={hasUnsaved ? handleSave : undefined}
            >
              <Text className={`block text-base font-medium ${hasUnsaved ? 'text-white' : 'text-gray-400'}`}>
                保存考勤 {hasUnsaved ? '' : '(无变化)'}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
