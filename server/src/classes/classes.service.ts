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

    // 统计每个班级的幼儿数量（从 children 表查询）
    if (data && data.length > 0) {
      const classIds = data.map(c => c.id);
      const { data: childCounts } = await this.client
        .from('children')
        .select('class_id')
        .eq('status', 'active')
        .in('class_id', classIds);

      const countMap: Record<string, number> = {};
      (childCounts || []).forEach(ch => {
        const cid = (ch as { class_id: string }).class_id;
        countMap[cid] = (countMap[cid] || 0) + 1;
      });
      data.forEach(cls => {
        (cls as Record<string, unknown>).student_count = countMap[cls.id] || 0;
      });
    }

    // 关联查询每个班级的带班教师（从 teachers 表查询）
    if (data && data.length > 0) {
      const classIds = data.map(c => c.id);
      const { data: teachers } = await this.client
        .from('teachers')
        .select('id, real_name, nickname, class_id, status')
        .eq('status', 'active')
        .in('class_id', classIds);

      const teacherMap: Record<string, string[]> = {};
      (teachers || []).forEach(t => {
        const cid = (t as { class_id: string }).class_id;
        const name = (t as { nickname: string | null }).nickname || (t as { real_name: string }).real_name;
        if (!teacherMap[cid]) teacherMap[cid] = [];
        teacherMap[cid].push(name);
      });
      data.forEach(cls => {
        (cls as Record<string, unknown>).teacher_names = teacherMap[cls.id] || [];
      });
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

    // 获取教师列表（从 teachers 表查询）
    const { data: teacherData } = await this.client
      .from('teachers')
      .select('id, real_name, nickname, title')
      .eq('class_id', id)
      .eq('status', 'active');

    const teachers = (teacherData || []).map(t => ({
      id: t.id,
      real_name: t.nickname || t.real_name,
      title: t.title,
    }));

    // 获取学生数量（从 children 表查询）
    const { count: studentCount } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', id)
      .eq('status', 'active');

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
