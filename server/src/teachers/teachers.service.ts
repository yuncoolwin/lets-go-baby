import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class TeachersService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 创建教师
   */
  async create(dto: {
    real_name: string;
    phone?: string;
    qualification?: string;
    specialty?: string;
    status?: string;
  }) {
    // 检查是否已存在同名教师
    const { data: existing } = await this.client
      .from('teachers')
      .select('id')
      .eq('real_name', dto.real_name)
      .neq('status', 'inactive')
      .limit(1);

    if (existing && existing.length > 0) {
      return { error: true, code: 400, msg: '已存在同名教师' };
    }

    const { data, error } = await this.client
      .from('teachers')
      .insert({
        real_name: dto.real_name,
        phone: dto.phone || null,
        qualification: dto.qualification || null,
        specialty: dto.specialty || null,
        status: dto.status || 'active',
      })
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `创建失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 列表查询（分页 + 筛选 + 搜索）
   */
  async findAll(query: {
    page?: number;
    page_size?: number;
    status?: string;
    keyword?: string;
  }) {
    const page = query.page || 1;
    const pageSize = query.page_size || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.client
      .from('teachers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      builder = builder.eq('status', query.status);
    }
    if (query.keyword) {
      builder = builder.ilike('real_name', `%${query.keyword}%`);
    }

    const { data, count, error } = await builder;

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }
    return { list: data || [], total: count || 0, page, page_size: pageSize };
  }

  /**
   * 详情（含负责班级）
   */
  async findOne(id: string) {
    const { data: teacher, error } = await this.client
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !teacher) {
      return { error: true, code: 404, msg: '教师不存在' };
    }

    // 查询该教师负责的班级
    const { data: classMembers } = await this.client
      .from('class_members')
      .select('class_id')
      .eq('member_id', id)
      .eq('member_type', 'teacher');

    let classes: Array<{ id: string; name: string; level: string | null; room: string | null }> | null = null;
    if (classMembers && classMembers.length > 0) {
      const classIds = classMembers.map(m => m.class_id);
      const { data: classData } = await this.client
        .from('classes')
        .select('id, name, level, room')
        .in('id', classIds)
        .eq('status', 'active');
      classes = classData || null;
    }

    return { ...teacher, classes: classes || [] };
  }

  /**
   * 更新教师信息
   */
  async update(id: string, dto: {
    real_name?: string;
    phone?: string;
    qualification?: string;
    specialty?: string;
    status?: string;
    user_id?: string;
  }) {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.real_name !== undefined) updateData.real_name = dto.real_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.qualification !== undefined) updateData.qualification = dto.qualification;
    if (dto.specialty !== undefined) updateData.specialty = dto.specialty;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.user_id !== undefined) updateData.user_id = dto.user_id;

    const { data, error } = await this.client
      .from('teachers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `更新失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 软删除（设为 inactive）
   */
  async remove(id: string) {
    const { data, error } = await this.client
      .from('teachers')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `删除失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 统计
   */
  async getStats() {
    const { count: total } = await this.client
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'inactive');

    const { count: active } = await this.client
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: inactive } = await this.client
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'inactive');

    return {
      total: total || 0,
      active: active || 0,
      inactive: inactive || 0,
    };
  }
}
