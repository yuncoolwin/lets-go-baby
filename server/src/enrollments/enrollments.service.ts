import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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