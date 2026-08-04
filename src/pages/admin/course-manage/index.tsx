import { useState, useEffect, useCallback } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { courseApi, classApi } from '@/utils/api'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react-taro'

interface Course {
  id: string
  name: string
  class_id: string | null
  duration_options: string[]
  date_calc_rule: string
  sort_order: number
  status: string
  created_at: string
}

interface ClassItem {
  id: string
  name: string
}

const durationOptions = ['一周体验', '1个月', '3个月', '6个月', '12个月', '计日']

const dateCalcRuleOptions = ['工作日', '周六']

const statusOptions = ['启用', '停用']

const courseTypeColors: Record<string, string> = {
  '全日托': 'bg-orange-50 text-orange-700 border-orange-200',
  '半日托': 'bg-sky-50 text-sky-700 border-sky-200',
  '周六托': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '晚间托': 'bg-purple-50 text-purple-700 border-purple-200',
  '兴趣班': 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function CourseManagePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassItem[]>([])

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  // 表单
  const [formName, setFormName] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formDurationOptions, setFormDurationOptions] = useState<string[]>([])
  const [formDateCalcRule, setFormDateCalcRule] = useState('weekday')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formStatus, setFormStatus] = useState('启用')

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await courseApi.list()
      console.log('[CourseManage] list:', res)
      if (res.code === 200 && res.data) {
        setCourses(res.data || [])
      }
    } catch (err) {
      console.error('[CourseManage] error:', err)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    }
    setLoading(false)
  }, [])

  const loadClasses = useCallback(async () => {
    try {
      const res = await classApi.list()
      console.log('[CourseManage] classes:', res)
      if (res.code === 200 && res.data?.list) {
        setClasses(res.data.list.map((c: any) => ({ id: c.id, name: c.name })))
      }
    } catch (err) {
      console.error('[CourseManage] loadClasses error:', err)
    }
  }, [])

  useEffect(() => {
    loadCourses()
    loadClasses()
  }, [loadCourses, loadClasses])

  useDidShow(() => {
    loadCourses()
  })

  const openCreateDialog = () => {
    setEditingCourse(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (course: Course) => {
    setEditingCourse(course)
    setFormName(course.name)
    setFormClassId(course.class_id || '')
    setFormDurationOptions(course.duration_options || [])
    setFormDateCalcRule(course.date_calc_rule || 'weekday')
    setFormSortOrder(String(course.sort_order || 0))
    setFormStatus(course.status || '启用')
    setDialogOpen(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormClassId('')
    setFormDurationOptions([])
    setFormDateCalcRule('weekday')
    setFormSortOrder('0')
    setFormStatus('启用')
  }

  const toggleDurationOption = (opt: string) => {
    setFormDurationOptions(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    )
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      Taro.showToast({ title: '请输入课程名称', icon: 'none' })
      return
    }

    const payload = {
      name: formName.trim(),
      class_id: formClassId || null,
      duration_options: formDurationOptions,
      date_calc_rule: formDateCalcRule,
      sort_order: parseInt(formSortOrder) || 0,
      status: formStatus,
    }

    try {
      let res: any
      if (editingCourse) {
        res = await courseApi.update(editingCourse.id, payload)
        console.log('[CourseManage] update:', res)
      } else {
        res = await courseApi.create(payload)
        console.log('[CourseManage] create:', res)
      }

      if (res.code === 200) {
        Taro.showToast({ title: editingCourse ? '修改成功' : '新增成功', icon: 'success' })
        setDialogOpen(false)
        loadCourses()
      } else {
        Taro.showToast({ title: res.msg || '操作失败', icon: 'error' })
      }
    } catch (err) {
      console.error('[CourseManage] submit error:', err)
      Taro.showToast({ title: '操作失败', icon: 'error' })
    }
  }

  const handleDelete = (course: Course) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除课程「${course.name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await courseApi.remove(course.id)
            console.log('[CourseManage] delete:', result)
            if (result.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              loadCourses()
            } else {
              Taro.showToast({ title: result.msg || '删除失败', icon: 'error' })
            }
          } catch (err) {
            console.error('[CourseManage] delete error:', err)
            Taro.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      },
    })
  }

  const getClassName = (classId: string | null) => {
    if (!classId) return '—'
    const cls = classes.find(c => c.id === classId)
    return cls?.name || '—'
  }

  const getColorClass = (name: string) => {
    return courseTypeColors[name] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const classPickerRange = classes.map(c => c.name)
  const classPickerValues = classes.map(c => c.id)

  if (loading) {
    return (
      <View className="min-h-screen bg-background p-4">
        <Skeleton className="h-10 w-full mb-3 rounded-lg" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full mb-3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background p-4 pb-20">
      {/* 顶部操作栏 */}
      <View className="flex items-center justify-between mb-4">
        <Text className="block text-lg font-bold text-foreground">
          课程列表
        </Text>
        <Button
          className="bg-primary text-primary-foreground rounded-xl h-9 px-4"
          onClick={openCreateDialog}
        >
          <Plus size={16} color="#fff" className="mr-1" />
          <Text>新增课程</Text>
        </Button>
      </View>

      {/* 课程列表 */}
      {courses.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20">
          <BookOpen size={48} color="#d0d0d0" />
          <Text className="block text-sm text-gray-400 mt-3">暂无课程</Text>
          <Text className="block text-xs text-gray-300 mt-1">点击右上角新增课程</Text>
        </View>
      ) : (
        <View className="space-y-3">
          {courses.map((course) => (
            <Card key={course.id} className="bg-white rounded-xl border-0 shadow-sm">
              <CardContent className="p-4">
                <View className="flex items-start justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex items-center gap-2 mb-2">
                      <Badge className={`${getColorClass(course.name)} border px-2 py-1 text-xs`}>
                        {course.name}
                      </Badge>
                      <Badge className={course.status === '启用' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>
                        {course.status}
                      </Badge>
                    </View>
                    <Text className="block text-xs text-gray-500">
                      关联班级：{getClassName(course.class_id)}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      报读时长：{course.duration_options?.length ? course.duration_options.join('、') : '未设置'}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      日期规则：{course.date_calc_rule === 'weekday' ? '工作日' : '周六'}　排序：{course.sort_order}
                    </Text>
                  </View>
                  <View className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      className="w-8 h-8 p-0"
                      onClick={() => openEditDialog(course)}
                    >
                      <Pencil size={16} color="#666" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-8 h-8 p-0"
                      onClick={() => handleDelete(course)}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white rounded-2xl p-6 max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>
              <Text className="block text-lg font-bold text-foreground">
                {editingCourse ? '编辑课程' : '新增课程'}
              </Text>
            </DialogTitle>
            <DialogClose onClick={() => setDialogOpen(false)} />
          </DialogHeader>

          <View className="space-y-4 mt-4">
            {/* 课程名称 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-1 block">课程名称</Label>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入课程名称"
                  value={formName}
                  onInput={(e) => setFormName(e.detail.value)}
                />
              </View>
            </View>

            {/* 关联班级 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-1 block">关联班级</Label>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Picker
                  mode="selector"
                  range={['不关联', ...classPickerRange]}
                  value={formClassId ? classPickerValues.indexOf(formClassId) + 1 : 0}
                  onChange={(e) => {
                    const idx = parseInt(String(e.detail.value))
                    if (idx === 0) {
                      setFormClassId('')
                    } else {
                      setFormClassId(classPickerValues[idx - 1])
                    }
                  }}
                >
                  <Text className="text-sm text-gray-700">
                    {formClassId ? getClassName(formClassId) : '不关联'}
                  </Text>
                </Picker>
              </View>
            </View>

            {/* 可选报读时长 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-2 block">可选报读时长（多选）</Label>
              <View className="flex flex-wrap gap-2">
                {durationOptions.map((opt) => (
                  <View
                    key={opt}
                    className={`px-3 py-1 rounded-lg border text-sm cursor-pointer ${
                      formDurationOptions.includes(opt)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                    onClick={() => toggleDurationOption(opt)}
                  >
                    <Text>{opt}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 日期计算规则 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-1 block">日期计算规则</Label>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Picker
                  mode="selector"
                  range={dateCalcRuleOptions}
                  value={formDateCalcRule === 'weekday' ? 0 : 1}
                  onChange={(e) => {
                    setFormDateCalcRule(parseInt(String(e.detail.value)) === 0 ? 'weekday' : 'saturday')
                  }}
                >
                  <Text className="text-sm text-gray-700">
                    {formDateCalcRule === 'weekday' ? '工作日' : '周六'}
                  </Text>
                </Picker>
              </View>
            </View>

            {/* 排序 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-1 block">排序</Label>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  type="number"
                  placeholder="输入排序数字"
                  value={formSortOrder}
                  onInput={(e) => setFormSortOrder(e.detail.value)}
                />
              </View>
            </View>

            {/* 状态 */}
            <View>
              <Label className="text-sm font-medium text-foreground mb-1 block">状态</Label>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Picker
                  mode="selector"
                  range={statusOptions}
                  value={formStatus === '启用' ? 0 : 1}
                  onChange={(e) => {
                    setFormStatus(parseInt(String(e.detail.value)) === 0 ? '启用' : '停用')
                  }}
                >
                  <Text className="text-sm text-gray-700">{formStatus}</Text>
                </Picker>
              </View>
            </View>

            {/* 提交按钮 */}
            <Button
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 mt-2"
              onClick={handleSubmit}
            >
              <Text>{editingCourse ? '保存修改' : '确认新增'}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}