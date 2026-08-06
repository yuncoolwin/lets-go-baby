import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createDateCalculator } from './utils/date-calculator';
import { HolidaysService } from '@/holidays/holidays.service';

@Injectable()
export class ChildrenService {
  constructor(
    @Inject(forwardRef(() => HolidaysService))
    private holidaysService: HolidaysService,
  ) {}

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
    class_id?: string | null;
    parent_name?: string;
    parent_phone?: string;
    health_info?: string;
    allergies?: string;
    status?: string;
    course_type?: string;
    enrollment_duration?: string;
    start_date?: string;
    end_date?: string;
    custom_days?: string;
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
        course_type: dto.course_type || null,
        enrollment_duration: dto.enrollment_duration || null,
        start_date: dto.start_date || null,
        end_date: dto.end_date || null,
        custom_days: dto.custom_days || null,
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

    // Step 1: 先获取所有匹配条件的幼儿（不含分页），仅取 id + created_at
    let idBuilder = this.client
      .from('children')
      .select('id, created_at', { count: 'exact' })
      .neq('status', 'archived');

    if (query.class_id) {
      idBuilder = idBuilder.eq('class_id', query.class_id);
    }
    if (query.status) {
      idBuilder = idBuilder.eq('status', query.status);
    }
    if (query.keyword) {
      idBuilder = idBuilder.ilike('name', `%${query.keyword}%`);
    }

    const { data: allChildren, count, error } = await idBuilder;

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }

    const childIds = (allChildren || []).map(c => c.id);
    const childCreatedAtMap = new Map((allChildren || []).map(c => [c.id, c.created_at]));

    // Step 2: 查询所有 enrollments，获取每个幼儿的最新报读时间
    let enrollmentTimeMap = new Map<string, string>();
    if (childIds.length > 0) {
      // 查询所有 enrollments（不限状态），按 child_id 分组取最大 created_at
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('child_id, created_at')
        .in('child_id', childIds);

      for (const e of enrollments || []) {
        const existing = enrollmentTimeMap.get(e.child_id);
        if (!existing || e.created_at > existing) {
          enrollmentTimeMap.set(e.child_id, e.created_at);
        }
      }
    }

    // Step 3: 按最新报读时间排序（降序），无报读的用幼儿 created_at 降序
    const sortedIds = childIds.sort((a, b) => {
      const timeA = enrollmentTimeMap.get(a) || childCreatedAtMap.get(a) || '';
      const timeB = enrollmentTimeMap.get(b) || childCreatedAtMap.get(b) || '';
      return timeB.localeCompare(timeA);
    });

    // Step 4: 分页
    const pagedIds = sortedIds.slice(from, to + 1);

    // Step 5: 查询完整幼儿数据
    let fullData: any[] = [];
    if (pagedIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('*')
        .in('id', pagedIds);
      
      // 保持分页顺序
      const dataMap = new Map((childrenData || []).map(c => [c.id, c]));
      fullData = pagedIds.map(id => dataMap.get(id)).filter(Boolean);
    }

    // 收集所有班级ID，批量查询教师
    const classIds = [...new Set((fullData || []).map((c: any) => c.class_id).filter(Boolean))];
    const teachersMap: Record<string, string[]> = {};
    if (classIds.length > 0) {
      const { data: teachers } = await this.client
        .from('teachers')
        .select('nickname, class_id')
        .in('class_id', classIds)
        .eq('status', 'active');
      for (const t of teachers || []) {
        const name = t.nickname || '';
        if (name && t.class_id) {
          if (!teachersMap[t.class_id]) teachersMap[t.class_id] = [];
          teachersMap[t.class_id].push(name);
        }
      }
    }

    // 批量查询所有进行中的 enrollments
    let enrollmentsMap: Record<string, any[]> = {};
    if (pagedIds.length > 0) {
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('*')
        .in('child_id', pagedIds)
        .eq('status', '进行中');
      
      // 收集所有 enrollments 中的 class_id，批量查询班级名称
      const enrClassIds = [...new Set((enrollments || []).map(e => e.class_id).filter(Boolean))];
      const enrClassMap: Record<string, string> = {};
      if (enrClassIds.length > 0) {
        const { data: enrClasses } = await this.client
          .from('classes')
          .select('id, name, room')
          .in('id', enrClassIds);
        for (const cls of enrClasses || []) {
          enrClassMap[cls.id] = cls.room ? `${cls.name}（${cls.room}）` : cls.name;
        }
      }
      
      for (const enr of enrollments || []) {
        if (!enrollmentsMap[enr.child_id]) enrollmentsMap[enr.child_id] = [];
        enrollmentsMap[enr.child_id].push({
          id: enr.id,
          course_type: enr.course_type,
          duration_type: enr.duration_type,
          start_date: enr.start_date,
          end_date: enr.end_date,
          extended_end_date: enr.extended_end_date,
          status: enr.status,
          class_name: enr.class_id ? (enrClassMap[enr.class_id] || null) : null,
          payment_amount: enr.payment_amount,
          payment_channel: enr.payment_channel,
        });
      }
    }

    const results = await Promise.all(
      (fullData || []).map(async (child: any) => {
        let className = null;
        if (child.class_id) {
          const { data: cls } = await this.client
            .from('classes')
            .select('name')
            .eq('id', child.class_id)
            .maybeSingle();
          className = cls?.name || null;
        }
        return {
          ...child,
          class_name: className,
          teacher_names: teachersMap[child.class_id] || [],
          enrollments: enrollmentsMap[child.id] || [],
        };
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
    class_id?: string | null;
    parent_name?: string;
    parent_phone?: string;
    health_info?: string;
    allergies?: string;
    status?: string;
    avatar_url?: string;
    notes?: string;
    course_type?: string;
    enrollment_duration?: string;
    start_date?: string;
    end_date?: string;
  }) {
    // 如果变更了 class_id，检查目标班级容量
    if (dto.class_id !== undefined) {
      const { data: currentChild } = await this.client
        .from('children')
        .select('class_id')
        .eq('id', id)
        .single();

      const isChangingClass = !currentChild || currentChild.class_id !== dto.class_id;

      if (isChangingClass && dto.class_id) {
        // 查询目标班级信息
        const { data: cls } = await this.client
          .from('classes')
          .select('id, name, capacity')
          .eq('id', dto.class_id)
          .single();

        if (!cls) {
          return { error: true, code: 404, msg: '班级不存在' };
        }

        if (cls.capacity) {
          // 统计目标班级当前人数（排除当前幼儿自身）
          const { count } = await this.client
            .from('children')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', dto.class_id)
            .eq('status', 'active')
            .neq('id', id);

          if ((count || 0) >= cls.capacity) {
            return { error: true, code: 400, msg: '该班级已满，无法分配' };
          }
        }
      }
    }

    // 如果状态改为毕业或休学，自动清除班级
    if (dto.status === 'graduated' || dto.status === 'suspended') {
      dto.class_id = null;
    }

    // 复制所有字段到 updateData（custom_days 已作为数据库字段）
    const updateData = { ...(dto as any) } as any;

    // 如果有报读时长和开始日期但没传结束日期，自动计算
    if (dto.enrollment_duration && dto.start_date && !dto.end_date) {
      // 从数据库读取节假日数据
      const year = new Date(dto.start_date).getFullYear();
      const { holidays: holidaySet, workWeekends: workWeekendSet } = await this.holidaysService.getDateSets(year);
      const calc = createDateCalculator(holidaySet, workWeekendSet);
      updateData.end_date = calc.calculateEndDate(
        dto.start_date as string,
        dto.course_type as string || '',
        dto.enrollment_duration as string,
        (dto as any).custom_days || ''
      );
    }

    // 清理 null 和 undefined 字段
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const { data, error } = await this.client
      .from('children')
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
