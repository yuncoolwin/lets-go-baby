/**
 * 创建班级 DTO
 * 注：项目未安装 class-validator，使用 plain interface 定义
 */
export interface CreateClassDto {
  name: string;
  level: 'nursery' | 'small' | 'medium' | 'large';
  capacity: number;
  room?: string;
  age_range?: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateClassDto {
  name?: string;
  level?: 'nursery' | 'small' | 'medium' | 'large';
  capacity?: number;
  room?: string;
  age_range?: string;
  status?: 'active' | 'inactive' | 'archived';
  description?: string;
}

export interface ClassQueryDto {
  page?: number;
  page_size?: number;
  level?: string;
  status?: string;
  keyword?: string;
}
