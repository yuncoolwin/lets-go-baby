import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { childrenApi, classApi } from '@/utils/api'
import BackButton from '@/components/back-button'

interface ClassItem {
  id: string
  name: string
  level: string
}

const statusOptions = [
  { value: 'active', label: '在读' },
  { value: 'graduated', label: '毕业' },
  { value: 'suspended', label: '休学' },
]

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

const durationOptions = [
  { value: '一周体验', label: '一周体验' },
  { value: '1个月', label: '1个月' },
  { value: '3个月', label: '3个月' },
  { value: '6个月', label: '6个月' },
  { value: '12个月', label: '12个月' },
  { value: '其他', label: '其他' },
]

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function getNextMonday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00+08:00')
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  if (dayOfWeek === 1) return dateStr
  // 顺延到下一个周一
  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString().split('T')[0]
}

export default function ChildEditPage() {
  const router = useRouter()
  const { id } = router.params
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [classes, setClasses] = useState<ClassItem[]>([])

  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState('active')
  const [classId, setClassId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [healthInfo, setHealthInfo] = useState('')
  const [courseType, setCourseType] = useState('')
  const [enrollmentDuration, setEnrollmentDuration] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [customDays, setCustomDays] = useState('')
  const calcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 当课程类型切换为周六托/兴趣班时，报读时长自动切换为"其他"
  const prevCourseTypeRef = useRef(courseType)
  useEffect(() => {
    const prev = prevCourseTypeRef.current
    prevCourseTypeRef.current = courseType
    if ((courseType === '周六托' || courseType === '兴趣班') && prev !== courseType) {
      setEnrollmentDuration('其他')
    }
  }, [courseType])

  // 当相关字段变化时，调用后端 API 计算结束日期
  const fetchEndDate = useCallback(async () => {
    if (!enrollmentDuration || !startDate) {
      setEndDate('')
      return
    }
    try {
      const res = await childrenApi.calcEndDate({
        course_type: courseType,
        enrollment_duration: enrollmentDuration,
        start_date: startDate,
        custom_days: enrollmentDuration === '其他' ? customDays : undefined,
      })
      if (res.code === 200 && res.data?.end_date) {
        setEndDate(res.data.end_date)
      }
    } catch {
      // 静默失败
    }
  }, [courseType, enrollmentDuration, startDate, customDays])

  useEffect(() => {
    if (calcTimerRef.current) {
      clearTimeout(calcTimerRef.current)
    }
    calcTimerRef.current = setTimeout(() => {
      fetchEndDate()
    }, 300)
    return () => {
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current)
    }
  }, [fetchEndDate])

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [childRes, classRes] = await Promise.all([
        childrenApi.detail(id),
        classApi.list({ page: 1, page_size: 100 }),
      ])
      if (childRes.code === 200 && childRes.data) {
        const child = childRes.data as any
        setName(child.name || '')
        setGender(child.gender || 'male')
        setBirthDate(child.birth_date || '')
        setStatus(child.status || 'active')
        setClassId(child.class_id || '')
        setParentName(child.parent_name || '')
        setParentPhone(child.parent_phone || '')
        setAllergies(child.allergies || '')
        setHealthInfo(child.health_info || '')
        setCourseType(child.course_type || '')
        setEnrollmentDuration(child.enrollment_duration || '')
        setStartDate(child.start_date || todayStr())
        setEndDate(child.end_date || '')
      }
      if (classRes.code === 200 && classRes.data) {
        const classData = classRes.data as any
        setClasses(Array.isArray(classData.list) ? classData.list : [])
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入幼儿姓名', icon: 'none' })
      return
    }
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        gender,
        birth_date: birthDate,
        status,
        class_id: classId || undefined,
        parent_name: parentName || undefined,
        parent_phone: parentPhone || undefined,
        allergies: allergies || undefined,
        health_info: healthInfo || undefined,
        course_type: courseType || undefined,
        enrollment_duration: enrollmentDuration || undefined,
        start_date: startDate || undefined,
        end_date: enrollmentDuration ? endDate || undefined : undefined,
      }
      const res = await childrenApi.update(id!, payload)
      if (res.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        const errMsg = res.msg || (res as any).message || '保存失败'
        Taro.showToast({ title: errMsg, icon: 'none', duration: 3000 })
        setSubmitting(false)
      }
    } catch {
      Taro.showToast({ title: '网络错误', icon: 'none', duration: 3000 })
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDurationSelect = (value: string) => {
    // 周六托/兴趣班只允许选择"其他"
    if ((courseType === '周六托' || courseType === '兴趣班') && value !== '其他') {
      Taro.showToast({ title: '该课程类型仅支持自定义天数', icon: 'none' })
      return
    }
    if (enrollmentDuration === value) {
      setEnrollmentDuration('')
      setCustomDays('')
    } else {
      setEnrollmentDuration(value)
      if (value !== '其他') {
        setCustomDays('')
      }
      // 一周体验的开始日期只能是周一
      if (value === '一周体验') {
        const monday = getNextMonday(startDate)
        if (monday !== startDate) {
          setStartDate(monday)
          Taro.showToast({ title: '开始日期已自动调整为下一个周一', icon: 'none' })
        }
      }
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 顶部导航 */}
      <View className="flex items-center gap-3 p-4 bg-white border-b border-border">
        <BackButton />
        <Text className="text-lg font-semibold text-foreground">编辑幼儿</Text>
      </View>

      <View className="p-4 space-y-4">
        <Card className="bg-white rounded-xl border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* 姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">姓名 *</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入幼儿姓名"
                  value={name}
                  onInput={(e) => setName(e.detail.value)}
                />
              </View>
            </View>

            {/* 性别 */}
            <View>
              <Label className="text-sm font-medium text-foreground">性别 *</Label>
              <View className="mt-1 flex gap-2">
                {genderOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      gender === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setGender(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 出生日期 */}
            <View>
              <Label className="text-sm font-medium text-foreground">出生日期 *</Label>
              <Picker
                mode="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.detail.value)}
              >
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="text-sm text-foreground">
                    {birthDate || '请选择出生日期'}
                  </Text>
                </View>
              </Picker>
            </View>

            {/* 在读状态 */}
            <View>
              <Label className="text-sm font-medium text-foreground">在读状态 *</Label>
              <View className="mt-1 flex gap-2">
                {statusOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      status === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setStatus(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 课程类型 */}
            <View>
              <Label className="text-sm font-medium text-foreground">课程类型</Label>
              <View className="mt-1 flex flex-wrap gap-2">
                {['全日托', '半日托', '周六托', '晚间托', '兴趣班'].map((t) => (
                  <View
                    key={t}
                    className={"px-4 py-2 rounded-lg text-sm " + (courseType === t ? 'bg-primary text-white' : 'bg-gray-100 text-foreground')}
                    onClick={() => setCourseType(courseType === t ? '' : t)}
                  >
                    <Text className="text-sm">{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 报读时长 */}
            <View>
              <Label className="text-sm font-medium text-foreground">报读时长</Label>
              <View className="mt-1 flex flex-wrap gap-2">
                {durationOptions.map((opt) => (
                  <View
                    key={opt.value}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      enrollmentDuration === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => handleDurationSelect(opt.value)}
                  >
                    <Text className="text-sm">{opt.label}</Text>
                  </View>
                ))}
              </View>
              {enrollmentDuration === '其他' && (
                <View className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                  <Input
                    className="w-full bg-transparent text-sm"
                    placeholder="请输入天数"
                    value={customDays}
                    onInput={(e) => setCustomDays(e.detail.value)}
                  />
                </View>
              )}
            </View>

            {/* 开始日期 */}
            <View>
              <Label className="text-sm font-medium text-foreground">开始日期</Label>
              <Picker
                mode="date"
                value={startDate}
                onChange={(e) => {
                  const newDate = e.detail.value
                  if (enrollmentDuration === '一周体验') {
                    const monday = getNextMonday(newDate)
                    if (monday !== newDate) {
                      setStartDate(monday)
                      Taro.showToast({ title: '一周体验的开始日期只能是周一，已自动调整为下一个周一', icon: 'none' })
                    } else {
                      setStartDate(newDate)
                    }
                  } else {
                    setStartDate(newDate)
                  }
                }}
              >
                <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  <Text className="text-sm text-foreground">
                    {startDate || '请选择开始日期'}
                  </Text>
                </View>
              </Picker>
            </View>

            {/* 结束日期（只读） */}
            <View>
              <Label className="text-sm font-medium text-foreground">结束日期</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Text className="text-sm text-foreground">
                  {endDate || '请先选择报读时长和开始日期'}
                </Text>
              </View>
            </View>

            {/* 班级 */}
            <View>
              <Label className="text-sm font-medium text-foreground">所在班级</Label>
              <View className="mt-1 flex flex-wrap gap-2">
                <View
                  className={`px-4 py-2 rounded-lg text-sm ${
                    !classId ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                  }`}
                  onClick={() => setClassId('')}
                >
                  <Text className="text-sm">未分班</Text>
                </View>
                {classes.map((cls) => (
                  <View
                    key={cls.id}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      classId === cls.id ? 'bg-primary text-white' : 'bg-gray-100 text-foreground'
                    }`}
                    onClick={() => setClassId(cls.id)}
                  >
                    <Text className="text-sm">{cls.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 过敏情况 */}
            <View>
              <Label className="text-sm font-medium text-foreground">过敏情况</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="无"
                  value={allergies}
                  onInput={(e) => setAllergies(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长姓名 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长姓名</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长姓名"
                  value={parentName}
                  onInput={(e) => setParentName(e.detail.value)}
                />
              </View>
            </View>

            {/* 家长电话 */}
            <View>
              <Label className="text-sm font-medium text-foreground">家长电话</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入家长电话"
                  value={parentPhone}
                  onInput={(e) => setParentPhone(e.detail.value)}
                />
              </View>
            </View>

            {/* 健康信息 */}
            <View>
              <Label className="text-sm font-medium text-foreground">健康信息</Label>
              <View className="mt-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入健康信息"
                  value={healthInfo}
                  onInput={(e) => setHealthInfo(e.detail.value)}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <Button
          className="w-full bg-primary text-white rounded-xl py-3"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <Text className="text-white">{submitting ? '保存中...' : '保存修改'}</Text>
        </Button>
      </View>
    </View>
  )
}
