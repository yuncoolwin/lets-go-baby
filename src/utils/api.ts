import { Network } from '@/network'

/**
 * 统一 API 请求工具
 * 封装 Network.request，提供各模块的 API 方法
 */

// ============ 通用类型 ============

interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

interface ListParams {
  page?: number
  pageSize?: number
  page_size?: number
  [key: string]: any
}

// ============ 请求封装 ============

const request = async <T = any>(option: {
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: any
  validateStatus?: (status: number) => boolean
}): Promise<ApiResponse<T>> => {
  // 过滤掉 undefined/null/空字符串值
  const cleanData: Record<string, any> = {}
  if (option.data) {
    Object.keys(option.data).forEach(key => {
      const val = option.data[key]
      if (val !== undefined && val !== null && val !== '') {
        cleanData[key] = val
      }
    })
  }
  const res = await Network.request({
    url: option.url,
    method: option.method || 'GET',
    data: Object.keys(cleanData).length > 0 ? cleanData : undefined,
    header: { 'Content-Type': 'application/json' },
    ...(option.validateStatus ? { validateStatus: option.validateStatus } : {}),
  })
  return res.data as ApiResponse<T>
}

// ============ 班级管理 API ============

export const classApi = {
  create: (data: Record<string, any>) =>
    request({ url: '/api/classes', method: 'POST', data }),

  list: (params?: ListParams) =>
    request({ url: '/api/classes', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/classes/${id}`, method: 'GET' }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/classes/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/classes/${id}`, method: 'DELETE' }),

  assignTeacher: (classId: string, data: { teacher_id: string; is_lead?: boolean }) =>
    request({ url: `/api/classes/${classId}/teachers`, method: 'POST', data }),

  removeTeacher: (classId: string, teacherId: string) =>
    request({ url: `/api/classes/${classId}/teachers/${teacherId}`, method: 'DELETE' }),

  stats: () =>
    request({ url: '/api/classes/stats', method: 'GET' }),
}

// ============ 幼儿管理 API ============

export const childrenApi = {
  create: (data: Record<string, any>) =>
    request({ url: '/api/children', method: 'POST', data }),

  list: (params?: ListParams) => {
    const query: Record<string, any> = { ...params }
    if (query.pageSize) {
      query.page_size = query.pageSize
      delete query.pageSize
    }
    return request({ url: '/api/children', method: 'GET', data: query })
  },

  detail: (id: string) =>
    request({ url: `/api/children/${id}`, method: 'GET' }),

  update: (id: string, data: Record<string, any>) =>
    request({
      url: `/api/children/${id}`,
      method: 'PATCH',
      data,
      validateStatus: () => true,
    }),

  calcEndDate: (data: { course_type: string; enrollment_duration: string; start_date: string; custom_days?: string }) =>
    request({ url: '/api/children/calc-end-date', method: 'POST', data }),

  remove: (id: string) =>
    request({ url: `/api/children/${id}`, method: 'DELETE' }),

  assignClass: (childId: string, classId: string) =>
    request({ url: `/api/children/${childId}/assign-class`, method: 'POST', data: { class_id: classId } }),

  stats: () =>
    request({ url: '/api/children/stats', method: 'GET' }),
}

// ============ 教师 API ============

export const teacherApi = {
  me: (teacherRoleId?: string) =>
    request({ url: '/api/teachers/me', method: 'GET', data: teacherRoleId ? { teacher_role_id: teacherRoleId } : undefined }),

  create: (data: Record<string, any>) =>
    request({ url: '/api/teachers', method: 'POST', data }),

  list: (params?: ListParams) =>
    request({ url: '/api/teachers', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/teachers/${id}`, method: 'GET' }),

  // 根据 teacher_id 获取教师信息（含班级）
  getById: (id: string) =>
    request({ url: `/api/teachers/${id}`, method: 'GET' }),

  // 获取班级学生列表（按课程类型分组）
  getClassStudents: (classId: string) =>
    request({ url: '/api/teachers/class-students', method: 'GET', data: { class_id: classId } }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/teachers/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/teachers/${id}`, method: 'DELETE' }),

  stats: () =>
    request({ url: '/api/teachers/stats', method: 'GET' }),
}

// ============ 通知管理 API ============

export const notificationApi = {
  create: (data: Record<string, any>) =>
    request({ url: '/api/notifications', method: 'POST', data }),

  list: (params?: ListParams) =>
    request({ url: '/api/notifications', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/notifications/${id}`, method: 'GET' }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/notifications/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/notifications/${id}`, method: 'DELETE' }),

  markRead: (id: string, userId: string) =>
    request({ url: `/api/notifications/${id}/read`, method: 'POST', data: { user_id: userId } }),

  stats: () =>
    request({ url: '/api/notifications/stats', method: 'GET' }),
}

// ============ 点名 API ============

export const attendanceApi = {
  // 获取班级点名列表（含当天状态）
  getByClass: (classId: string, date?: string) =>
    request({ url: '/api/attendance', method: 'GET', data: { class_id: classId, date } }),

  // 记录/更新点名状态
  record: (data: {
    child_id: string
    teacher_id: string
    class_id: string
    date: string
    status: 'present' | 'absent' | 'leave'
  }) =>
    request({ url: '/api/attendance', method: 'POST', data }),
}

export const authApi = {
  teacherLogin(phone: string) {
    return Network.request({
      url: '/api/auth/teacher-login',
      method: 'POST',
      data: { phone },
    });
  },
};

// ============ 报读记录 API ============

export const enrollmentApi = {
  list: (childId: string) =>
    request({ url: `/api/enrollments/child/${childId}`, method: 'GET' }),

  activeList: (childId: string) =>
    request({ url: `/api/enrollments/child/${childId}/active`, method: 'GET' }),

  create: (data: Record<string, any>) =>
    request({ url: '/api/enrollments', method: 'POST', data }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/enrollments/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/enrollments/${id}`, method: 'DELETE' }),
};
