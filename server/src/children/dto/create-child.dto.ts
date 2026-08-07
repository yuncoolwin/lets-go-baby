/**
 * 创建幼儿 DTO
 * 注：项目未安装 class-validator，使用 plain interface 定义
 */
export interface CreateChildDto {
  name: string;
  nickname?: string;
  gender: 'male' | 'female';
  birth_date: string;
  class_id?: string;
  parent_name?: string;
  parent_phone?: string;
  health_info?: string;
  allergies?: string;
  status?: 'active' | 'graduated' | 'suspended';
  course_type?: string;
  enrollment_duration?: string;
  start_date?: string;
  end_date?: string;
  custom_days?: string;
}

export interface UpdateChildDto {
  name?: string;
  nickname?: string;
  gender?: 'male' | 'female';
  birth_date?: string;
  class_id?: string;
  parent_name?: string;
  parent_phone?: string;
  health_info?: string;
  allergies?: string;
  status?: 'active' | 'graduated' | 'suspended';
  avatar_url?: string;
  notes?: string;
  course_type?: string;
  enrollment_duration?: string;
  start_date?: string;
  end_date?: string;
  custom_days?: string;
}

export interface ChildQueryDto {
  page?: number;
  page_size?: number;
  class_id?: string;
  status?: string;
  keyword?: string;
}
