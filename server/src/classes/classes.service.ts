import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { CreateClassDto, UpdateClassDto, ClassQueryDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 创建班级
   */
  async create(dto: CreateClassDto) {
    // 检查同名班级
    const { data: existing } = await this.client
      .from('classes')
      .select('id')
      .eq('name', dto.name)
      .neq('status', 'archived')
      .limit(1);

    if (existing && existing.length > 0) {
      return { error: true, code: 400, msg: '班级名称已存在' };
    }

    // 解析 age_range 为 min_age_months / max_age_months
    let minAgeMonths: number | null = null;
    let maxAgeMonths: number | null = null;
    if (dto.age_range) {
      const parts = dto.age_range.split('-').map(s => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        minAgeMonths = parts[0];
        maxAgeMonths = parts[1];
      }
    }

    const { data, error } = await this.client
      .from('classes')
      .insert({
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity,
        room: dto.room || null,
        description: dto.age_range || null,
        min_age_months: minAgeMonths,
        max_age_months: maxAgeMonths,
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
   * 列表查询（分页 + 筛选）
   */
  async findAll(query: ClassQueryDto) {
    const page = query.page || 1;
    const pageSize = query.page_size || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = this.client
      .from('classes')
      .select('*', { count: 'exact' })
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (query.level) {
      qb = qb.eq('level', query.level);
    }
    if (query.status) {
      qb = qb.eq('status', query.status);
    }
    if (query.keyword) {
      qb = qb.ilike('name', `%${query.keyword}%`);
    }

    const { data, error, count } = await qb.range(from, to);

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }

    return {
      list: data || [],
      total: count || 0,
      page,
      page_size: pageSize,
    };
  }

  /**
   * 详情（含教师列表）
   */
  async findOne(id: string) {
    const { data: classData, error } = await this.client
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !classData) {
      return { error: true, code: 404, msg: '班级不存在' };
    }

    // 获取教师列表
    const { data: members } = await this.client
      .from('class_members')
      .select('member_id')
      .eq('class_id', id)
      .eq('member_type', 'teacher');

    let teachers: Array<{ id: string; real_name: string | null }> = [];
    if (members && members.length > 0) {
      const teacherIds = members.map(m => m.member_id);
      const { data: roles } = await this.client
        .from('user_roles')
        .select('id, real_name')
        .in('id', teacherIds)
        .eq('role_type', 'teacher');
      teachers = roles || [];
    }

    // 获取学生数量
    const { count: studentCount } = await this.client
      .from('class_members')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', id)
      .eq('member_type', 'student');

    return {
      ...classData,
      teachers,
      student_count: studentCount || 0,
    };
  }

  /**
   * 更新班级
   */
  async update(id: string, dto: UpdateClassDto) {
    // 检查同名（排除自身）
    if (dto.name) {
      const { data: existing } = await this.client
        .from('classes')
        .select('id')
        .eq('name', dto.name)
        .neq('id', id)
        .neq('status', 'archived')
        .limit(1);

      if (existing && existing.length > 0) {
        return { error: true, code: 400, msg: '班级名称已存在' };
      }
    }

    // 解析 age_range
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.level !== undefined) updateData.level = dto.level;
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.room !== undefined) updateData.room = dto.room;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.age_range !== undefined) {
      updateData.description = dto.age_range;
      const parts = dto.age_range.split('-').map(s => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        updateData.min_age_months = parts[0];
        updateData.max_age_months = parts[1];
      }
    }
    if (dto.description !== undefined) updateData.description = dto.description;

    const { data, error } = await this.client
      .from('classes')
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
   * 软删除（设为 archived）
   */
  async remove(id: string) {
    const { data, error } = await this.client
      .from('classes')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `删除失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 分配教师到班级
   */
  async assignTeacher(classId: string, teacherId: string, isLead: boolean) {
    // 检查班级是否存在
    const { data: classData } = await this.client
      .from('classes')
      .select('id')
      .eq('id', classId)
      .single();
    if (!classData) {
      return { error: true, code: 404, msg: '班级不存在' };
    }

    // 检查是否已分配
    const { data: existing } = await this.client
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('member_type', 'teacher')
      .eq('member_id', teacherId)
      .limit(1);

    if (existing && existing.length > 0) {
      return { error: true, code: 400, msg: '该教师已在班级中' };
    }

    const { data, error } = await this.client
      .from('class_members')
      .insert({
        class_id: classId,
        member_type: 'teacher',
        member_id: teacherId,
      })
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `分配失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 从班级移除教师
   */
  async removeTeacher(classId: string, teacherId: string) {
    const { error } = await this.client
      .from('class_members')
      .delete()
      .eq('class_id', classId)
      .eq('member_type', 'teacher')
      .eq('member_id', teacherId);

    if (error) {
      return { error: true, code: 500, msg: `移除失败: ${error.message}` };
    }
    return { success: true };
  }

  /**
   * 统计信息
   */
  async getStats() {
    // 总班级数
    const { count: totalClasses } = await this.client
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived');

    // 活跃班级数
    const { count: activeClasses } = await this.client
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 总教师分配数
    const { count: totalTeachers } = await this.client
      .from('class_members')
      .select('*', { count: 'exact', head: true })
      .eq('member_type', 'teacher');

    // 总学生分配数
    const { count: totalStudents } = await this.client
      .from('class_members')
      .select('*', { count: 'exact', head: true })
      .eq('member_type', 'student');

    return {
      total_classes: totalClasses || 0,
      active_classes: activeClasses || 0,
      total_teachers: totalTeachers || 0,
      total_students: totalStudents || 0,
    };
  }
}
