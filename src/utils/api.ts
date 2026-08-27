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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
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

  enrollments: (classId: string, params?: Record<string, string>) =>
    request({ url: `/api/classes/${classId}/enrollments`, method: 'GET', data: params }),

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

  calcEndDate: (data: { course_type: string; enrollment_duration: string; start_date: string; custom_days?: string; date_calc_rule?: string }) =>
    request({ url: '/api/children/calc-end-date', method: 'POST', data }),

  remove: (id: string, operator?: { operator_user_id?: string; operator_role_id?: string }) =>
    request({ url: `/api/children/${id}`, method: 'DELETE', data: { ...operator } }),

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

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/teachers/${id}`, method: 'PATCH', data }),

  remove: (id: string) =>
    request({ url: `/api/teachers/${id}`, method: 'DELETE' }),

  stats: () =>
    request({ url: '/api/teachers/stats', method: 'GET' }),
}

// ============ 通知管理 API ============

export const notificationApi = {
  // author_id 通过 url query 传（body 只传 title/content/type/target_ids/status）
  create: (data: Record<string, any>, authorId?: string) =>
    request({
      url: authorId ? `/api/notifications?author_id=${authorId}` : '/api/notifications',
      method: 'POST',
      data,
    }),

  // list 透传 scope / author_id / user_role_id / type / keyword 等 query 参数
  list: (params?: ListParams) =>
    request({ url: '/api/notifications', method: 'GET', data: params }),

  detail: (id: string) =>
    request({ url: `/api/notifications/${id}`, method: 'GET' }),

  update: (id: string, data: Record<string, any>, operatorRoleId?: string) =>
    request({ url: `/api/notifications/${id}`, method: 'PATCH', data: operatorRoleId ? { ...data, operator_role_id: operatorRoleId } : data }),

  remove: (id: string, operatorRoleId?: string) =>
    request({ url: `/api/notifications/${id}`, method: 'DELETE', data: operatorRoleId ? { operator_role_id: operatorRoleId } : undefined }),

  markRead: (id: string, userRoleId: string) =>
    request({ url: `/api/notifications/${id}/read`, method: 'POST', data: { user_role_id: userRoleId } }),

  revoke: (id: string) =>
    request({ url: `/api/notifications/${id}/revoke`, method: 'POST' }),

  stats: () =>
    request({ url: '/api/notifications/stats', method: 'GET' }),

  // 底部导航未读数（当前角色未读且通知仍 published）
  unreadCount: (userRoleId: string) =>
    request({ url: '/api/notifications/unread-count', method: 'GET', data: { user_role_id: userRoleId } }),

  // 图片上传（base64 字符串 + 文件名）
  uploadImage: (data: { image: string; name?: string }) =>
    request({ url: '/api/notifications/upload', method: 'POST', data }),
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
  phoneLogin(data: { login_code: string; phone_code?: string; mock_role?: string }) {
    return Network.request({
      url: '/api/auth/phone-login',
      method: 'POST',
      data,
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

  calcExtendedEndDate: (id: string) =>
    request({ url: `/api/enrollments/${id}/calc-extended-end-date`, method: 'GET' }),

  getAttendanceCalendar: (enrollmentId: string) =>
    request({ url: `/api/enrollments/${enrollmentId}/attendance-calendar`, method: 'GET' }),
}

// ============ 管理员 API ============

export const adminApi = {
  getChildParents: (childId: string) =>
    request({ url: `/api/admin/children/${childId}/parents`, method: 'GET' }),

  removeParentBinding: (childId: string, relationId: string) =>
    request({ url: `/api/admin/children/${childId}/parents/${relationId}`, method: 'DELETE' }),
};

// ============ 日常记录 API ============

export const dailyApi = {
  getDailyFeedback: (childId: string, date: string) =>
    request({ url: `/api/parent/daily-feedbacks?child_id=${childId}&feedback_date=${date}`, method: 'GET' }),

  getByChildAndDate: (childId: string, date: string) =>
    request({ url: `/api/parent/daily-feedbacks?child_id=${childId}&feedback_date=${date}`, method: 'GET' }),
}

// ============ 课程管理 API ============

export const courseApi = {
  list: (params?: ListParams) =>
    request({ url: '/api/courses', method: 'GET', data: params }),

  create: (data: Record<string, any>) =>
    request({ url: '/api/courses', method: 'POST', data }),

  update: (id: string, data: Record<string, any>) =>
    request({ url: `/api/courses/${id}`, method: 'PUT', data }),

  remove: (id: string, operator?: { operator_user_id?: string; operator_role_id?: string }) =>
    request({ url: `/api/courses/${id}`, method: 'DELETE', data: { ...operator } }),
}

// ============ 成长记录 API ============

export const growthApi = {
  // 图片上传（base64 + 文件名，后端 sharp 压缩转 webp）
  uploadImage: (data: { image: string; name?: string }) =>
    request({ url: '/api/growth-records/upload', method: 'POST', data }),

  // 新建记录（role_id 为当前角色 id，用于权限校验与 teacher_id 落库）
  create: (data: { child_id: string; title: string; content?: string; photo_urls?: string[]; record_date?: string; course_name?: string }, roleId?: string) =>
    request({ url: roleId ? `/api/growth-records?role_id=${roleId}` : '/api/growth-records', method: 'POST', data }),

  // 记录列表（child_id/child_ids/record_date 筛选 + 分页 + 角色权限）
  list: (params?: { child_id?: string; child_ids?: string; record_date?: string; page?: number; page_size?: number; role_id?: string }) =>
    request({ url: '/api/growth-records', method: 'GET', data: params }),

  // 记录详情
  detail: (id: string, roleId?: string) =>
    request({ url: roleId ? `/api/growth-records/${id}?role_id=${roleId}` : `/api/growth-records/${id}`, method: 'GET' }),

  // 编辑记录
  update: (id: string, data: { title?: string; content?: string; photo_urls?: string[]; record_date?: string; course_name?: string }, roleId?: string) =>
    request({ url: roleId ? `/api/growth-records/${id}?role_id=${roleId}` : `/api/growth-records/${id}`, method: 'PUT', data }),

  // 删除记录（后端同步删除 Supabase Storage 图片）
  remove: (id: string, roleId?: string) =>
    request({ url: roleId ? `/api/growth-records/${id}?role_id=${roleId}` : `/api/growth-records/${id}`, method: 'DELETE' }),
}
