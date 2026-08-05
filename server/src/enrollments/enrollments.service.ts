import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface HolidayDetail {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  overlapDays: number;
}

export interface Enrollment {
  id: string;
  child_id: string;
  class_id: string;
  course_type: string;
  course_id?: string;
  duration_type: string;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  extended_end_date: string | null;
  payment_amount: string | null;
  payment_channel: string | null;
  status: string;
  date_calc_rule?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentDto {
  child_id: string;
  class_id?: string;
  course_type: string;
  course_id?: string;
  duration_type: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
  date_calc_rule?: string;
}

export interface UpdateEnrollmentDto {
  course_type?: string;
  course_id?: string;
  duration_type?: string;
  duration_days?: number;
  start_date?: string;
  end_date?: string;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
  class_id?: string;
  date_calc_rule?: string;
}

@Injectable()
export class EnrollmentsService {
  private get client() {
    return getSupabaseClient();
  }

  private async syncExpiredStatus(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await this.client
      .from('enrollments')
      .update({ status: '已结束', updated_at: new Date().toISOString() })
      .eq('status', '进行中')
      .lt('end_date', today);

    if (error) console.error('自动更新过期报读状态失败:', error.message);
  }

  /**
   * 日期字符串加减天数（纯字符串操作，避免 timezone 问题）
   */
  private addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /**
   * 计算顺延结束日期
   * 查询报读期间重叠的假期，累计天数后顺延
   */
  async calculateExtendedEndDate(enrollmentId: string): Promise<{ extended_end_date: string | null; details: HolidayDetail[] }> {
    const result = { extended_end_date: null as string | null, details: [] as HolidayDetail[] };

    // 获取报读记录
    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) return result;
    if (!enr.start_date || !enr.end_date) return result;

    const startDate = enr.start_date;
    const endDate = enr.end_date;

    // 获取幼儿所在班级
    const { data: child } = await this.client
      .from('children')
      .select('class_id')
      .eq('id', enr.child_id)
      .single();

    const classId = child?.class_id || '';

    // 查询该报读期间内重叠的假期（全园 + 班级 + 个人）
    const { data: holidays } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['all', 'class', 'personal'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    // 筛选出匹配的假期（班级假期匹配班级ID，个人假期匹配幼儿ID）
    const matchingHolidays = (holidays || []).filter(h => {
      if (h.type === 'all') return true;
      if (h.type === 'class') return h.target_id === classId;
      if (h.type === 'personal') return h.target_id === enr.child_id;
      return false;
    });

    // 收集报读期间内所有重叠的假期日期，同时生成明细
    const holidayDates = new Set<string>();
    for (const h of matchingHolidays) {
      let current = h.start_date > startDate ? h.start_date : startDate;
      const maxDate = h.end_date < endDate ? h.end_date : endDate;
      let overlapCount = 0;
      while (current <= maxDate) {
        holidayDates.add(current);
        overlapCount++;
        current = this.addDays(current, 1);
      }
      if (overlapCount > 0) {
        result.details.push({
          name: h.name,
          type: h.type,
          startDate: h.start_date,
          endDate: h.end_date,
          overlapDays: overlapCount,
        });
      }
    }

    const totalHolidayDays = holidayDates.size;
    if (totalHolidayDays === 0) return result;

    // 顺延 endDate，跳过顺延后的周末和节假日
    let extendedDate = endDate;
    let remainingDays = totalHolidayDays;

    while (remainingDays > 0) {
      extendedDate = this.addDays(extendedDate, 1);
      const [y, m, d] = extendedDate.split('-').map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      // 跳过周末
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      // 跳过法定节假日
      if (holidayDates.has(extendedDate)) continue;
      remainingDays--;
    }

    result.extended_end_date = extendedDate;
    return result;
  }

  async findByChild(childId: string): Promise<Enrollment[]> {
    await this.syncExpiredStatus();
    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询报读记录失败: ${error.message}`);
    return data || [];
  }

  async findActiveByChild(childId: string): Promise<Enrollment[]> {
    await this.syncExpiredStatus();
    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('child_id', childId)
      .eq('status', '进行中')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询进行中报读失败: ${error.message}`);
    return data || [];
  }

  async create(dto: CreateEnrollmentDto): Promise<Enrollment> {
    const { class_id, course_id, ...rest } = dto;

    // 如果传了 course_id，从 courses 表查询名称；否则尝试按 course_type 查找
    let finalCourseId = course_id || null;
    let finalCourseType = rest.course_type || '';

    if (finalCourseId) {
      const { data: course } = await this.client
        .from('courses')
        .select('name')
        .eq('id', finalCourseId)
        .single();
      if (course) finalCourseType = course.name;
    } else if (finalCourseType) {
      const { data: course } = await this.client
        .from('courses')
        .select('id')
        .eq('name', finalCourseType)
        .maybeSingle();
      if (course) finalCourseId = course.id;
    }

    const { data, error } = await this.client
      .from('enrollments')
      .insert({
        child_id: rest.child_id,
        course_type: finalCourseType,
        course_id: finalCourseId,
        duration_type: rest.duration_type || '',
        duration_days: rest.duration_days || 0,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        payment_amount: rest.payment_amount || null,
        payment_channel: rest.payment_channel || null,
        status: rest.status || '进行中',
        class_id: class_id || null,
        date_calc_rule: rest.date_calc_rule || '工作日',
      })
      .select()
      .single();

    if (error) throw new Error(`创建报读记录失败: ${error.message}`);

    // 计算并更新顺延结束日期
    if (data.start_date && data.end_date) {
      const extendedDate = await this.calculateExtendedEndDate(data.id);
      if (extendedDate) {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: extendedDate })
          .eq('id', data.id);
        data.extended_end_date = extendedDate;
      }
    }

    // 同步更新幼儿的班级字段
    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', rest.child_id);
    }

    return data;
  }

  async update(id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const { class_id, course_id, ...rest } = dto;
    const updateData: Record<string, any> = {};
    if (rest.course_type !== undefined) updateData.course_type = rest.course_type;
    if (course_id !== undefined) updateData.course_id = course_id;
    if (rest.duration_type !== undefined) updateData.duration_type = rest.duration_type;
    if (rest.duration_days !== undefined) updateData.duration_days = rest.duration_days;
    if (rest.start_date !== undefined) updateData.start_date = rest.start_date;
    if (rest.end_date !== undefined) updateData.end_date = rest.end_date;
    if (rest.payment_amount !== undefined) updateData.payment_amount = rest.payment_amount;
    if (rest.payment_channel !== undefined) updateData.payment_channel = rest.payment_channel;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.date_calc_rule !== undefined) updateData.date_calc_rule = rest.date_calc_rule;
    if (class_id !== undefined) updateData.class_id = class_id;
    updateData.updated_at = new Date().toISOString();

    // 如果更新了 course_id，同步更新 course_type
    if (course_id) {
      const { data: course } = await this.client
        .from('courses')
        .select('name')
        .eq('id', course_id)
        .single();
      if (course) updateData.course_type = course.name;
    }

    const { data, error } = await this.client
      .from('enrollments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新报读记录失败: ${error.message}`);

    // 如果有日期变更，重新计算并更新顺延结束日期
    if (data.start_date && data.end_date) {
      const { extended_end_date: extendedDate } = await this.calculateExtendedEndDate(data.id);
      if (extendedDate) {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: extendedDate })
          .eq('id', data.id);
        data.extended_end_date = extendedDate;
      } else {
        // 无顺延则清空
        await this.client
          .from('enrollments')
          .update({ extended_end_date: null })
          .eq('id', data.id);
        data.extended_end_date = null;
      }
    }

    // 同步更新幼儿的班级字段
    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', data.child_id);
    }

    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除报读记录失败: ${error.message}`);
  }
}