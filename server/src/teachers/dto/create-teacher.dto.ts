/**
 * 创建教师 DTO
 * 注：项目未安装 class-validator，使用 plain interface 定义
 */
export interface CreateTeacherDto {
  real_name: string;
  nickname?: string;
  phone?: string;
  qualification?: string;
  specialty?: string;
  status?: 'active' | 'inactive';
  class_id?: string;
  entry_date?: string;
  leave_date?: string;
}

export interface UpdateTeacherDto {
  real_name?: string;
  nickname?: string;
  phone?: string;
  qualification?: string;
  specialty?: string;
  status?: 'active' | 'inactive';
  user_id?: string;
  class_id?: string;
  entry_date?: string;
  leave_date?: string;
}

export interface TeacherQueryDto {
  page?: number;
  page_size?: number;
  status?: string;
  keyword?: string;
}
