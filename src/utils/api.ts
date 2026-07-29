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
  [key: string]: any
}

// ============ 请求封装 ============

const request = async <T = any>(option: {
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: any
}): Promise<ApiResponse<T>> => {
  const res = await Network.request({
    url: option.url,
    method: option.method || 'GET',
    data: option.data,
    header: { 'Content-Type': 'application/json' },
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

  list: (params?: ListParams) =>
    request({ url: '/api/children', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/children/${id}`, method: 'GET' }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/children/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/children/${id}`, method: 'DELETE' }),

  assignClass: (childId: string, classId: string) =>
    request({ url: `/api/children/${childId}/assign-class`, method: 'POST', data: { class_id: classId } }),

  stats: () =>
    request({ url: '/api/children/stats', method: 'GET' }),
}

// ============ 教师管理 API ============

export const teacherApi = {
  create: (data: Record<string, any>) =>
    request({ url: '/api/teachers', method: 'POST', data }),

  list: (params?: ListParams) =>
    request({ url: '/api/teachers', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/teachers/${id}`, method: 'GET' }),

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
