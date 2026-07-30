import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class ChildrenService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 创建幼儿档案
   */
  async create(dto: {
    name: string;
    gender: string;
    birth_date: string;
    class_id?: string;
    parent_name?: string;
    parent_phone?: string;
    health_info?: string;
    allergies?: string;
    status?: string;
  }) {
    // 检查是否已存在同名幼儿
    const { data: existing } = await this.client
      .from('children')
      .select('id')
      .eq('name', dto.name)
      .eq('status', 'active')
      .limit(1);

    if (existing && existing.length > 0) {
      return { error: true, code: 400, msg: '已存在同名幼儿档案' };
    }

    const { data, error } = await this.client
      .from('children')
      .insert({
        name: dto.name,
        gender: dto.gender,
        birth_date: dto.birth_date,
        class_id: dto.class_id || null,
        health_info: dto.health_info || null,
        allergies: dto.allergies || null,
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
  async findAll(query: {
    page?: number;
    page_size?: number;
    class_id?: string;
    status?: string;
    keyword?: string;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.client
      .from('children')
      .select('*', { count: 'exact' })
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (query.class_id) {
      builder = builder.eq('class_id', query.class_id);
    }
    if (query.status) {
      builder = builder.eq('status', query.status);
    }
    if (query.keyword) {
      builder = builder.ilike('name', `%${query.keyword}%`);
    }

    builder = builder.range(from, to);

    const { data, count, error } = await builder;

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }

    // 逐条获取班级名称
    const results = await Promise.all(
      (data || []).map(async (child) => {
        let className = null;
        if (child.class_id) {
          const { data: cls } = await this.client
            .from('classes')
            .select('name')
            .eq('id', child.class_id)
            .maybeSingle();
          className = cls?.name || null;
        }
        return { ...child, class_name: className };
      })
    );

    return {
      list: results,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * 详情（含班级信息）
   */
  async findOne(id: string) {
    const { data: child, error } = await this.client
      .from('children')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !child) {
      return { error: true, code: 404, msg: '幼儿档案不存在' };
    }

    // 获取班级信息
    let classInfo: { id: string; name: string; level: string; room: string } | null = null;
    if (child.class_id) {
      const { data: cls } = await this.client
        .from('classes')
        .select('id, name, level, room')
        .eq('id', child.class_id)
        .maybeSingle();
      classInfo = cls;
    }

    return { ...child, class_info: classInfo };
  }

  /**
   * 更新幼儿档案
   */
  async update(id: string, dto: {
    name?: string;
    gender?: string;
    birth_date?: string;
    class_id?: string;
    parent_name?: string;
    parent_phone?: string;
    health_info?: string;
    allergies?: string;
    status?: string;
    avatar_url?: string;
    notes?: string;
  }) {
    const { data, error } = await this.client
      .from('children')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `更新失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 软删除
   */
  async remove(id: string) {
    const { data, error } = await this.client
      .from('children')
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
   * 分班（检查班级容量）
   */
  async assignClass(childId: string, classId: string) {
    // 检查幼儿是否存在
    const { data: child } = await this.client
      .from('children')
      .select('id, name, class_id')
      .eq('id', childId)
      .single();

    if (!child) {
      return { error: true, code: 404, msg: '幼儿档案不存在' };
    }

    // 检查班级是否存在
    const { data: cls } = await this.client
      .from('classes')
      .select('id, name, capacity, status')
      .eq('id', classId)
      .single();

    if (!cls) {
      return { error: true, code: 404, msg: '班级不存在' };
    }

    if (cls.status !== 'active') {
      return { error: true, code: 400, msg: '班级未激活，无法分班' };
    }

    // 检查班级容量
    const { count: currentCount } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', 'active');

    if (cls.capacity && (currentCount || 0) >= cls.capacity) {
      return { error: true, code: 400, msg: `班级已满（${currentCount}/${cls.capacity}），无法分班` };
    }

    // 执行分班
    const { data, error } = await this.client
      .from('children')
      .update({ class_id: classId })
      .eq('id', childId)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `分班失败: ${error.message}` };
    }
    return { ...data, class_name: cls.name };
  }

  /**
   * 统计信息
   */
  async getStats() {
    // 总幼儿数
    const { count: totalChildren } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived');

    // 在园幼儿数
    const { count: activeChildren } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 已分班幼儿数
    const { count: assignedChildren } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .not('class_id', 'is', null);

    // 未分班幼儿数
    const unassignedChildren = (activeChildren || 0) - (assignedChildren || 0);

    // 各状态统计
    const { count: graduatedCount } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'graduated');

    const { count: suspendedCount } = await this.client
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suspended');

    return {
      total_children: totalChildren || 0,
      active_children: activeChildren || 0,
      assigned_children: assignedChildren || 0,
      unassigned_children: unassignedChildren,
      graduated_children: graduatedCount || 0,
      suspended_children: suspendedCount || 0,
    };
  }
}
