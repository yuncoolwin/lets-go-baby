import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface Enrollment {
  id: string;
  child_id: string;
  class_id: string;
  course_type: string;
  duration_type: string;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  payment_amount: string | null;
  payment_channel: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentDto {
  child_id: string;
  class_id?: string;
  course_type: string;
  duration_type: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
}

export interface UpdateEnrollmentDto {
  course_type?: string;
  duration_type?: string;
  duration_days?: number;
  start_date?: string;
  end_date?: string;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
  class_id?: string;
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
    const { class_id, ...rest } = dto;

    // 插入新记录
    const { data: insertData, error: insertError } = await this.client
      .from('enrollments')
      .insert({
        child_id: rest.child_id,
        course_type: rest.course_type || '',
        duration_type: rest.duration_type || '',
        duration_days: rest.duration_days || 0,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        payment_amount: rest.payment_amount || null,
        payment_channel: rest.payment_channel || null,
        status: rest.status || '进行中',
        class_id: class_id || null,
      })
      .select()
      .single();

    if (insertError) throw new Error(`创建报读记录失败: ${insertError.message}`);

    return insertData;
  }

  async update(id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const { class_id, ...rest } = dto;
    const updateData: Record<string, any> = {};
    if (rest.course_type !== undefined) updateData.course_type = rest.course_type;
    if (rest.duration_type !== undefined) updateData.duration_type = rest.duration_type;
    if (rest.duration_days !== undefined) updateData.duration_days = rest.duration_days;
    if (rest.start_date !== undefined) updateData.start_date = rest.start_date;
    if (rest.end_date !== undefined) updateData.end_date = rest.end_date;
    if (rest.payment_amount !== undefined) updateData.payment_amount = rest.payment_amount;
    if (rest.payment_channel !== undefined) updateData.payment_channel = rest.payment_channel;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (class_id !== undefined) updateData.class_id = class_id;
    updateData.updated_at = new Date().toISOString();

    // 更新记录并返回更新后的数据
    const { data: updatedRecord, error: updateError } = await this.client
      .from('enrollments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new Error(`更新报读记录失败: ${updateError.message}`);
    if (!updatedRecord) throw new Error('更新报读记录失败: 未找到更新的记录');

    // 同步更新幼儿的班级字段
    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', updatedRecord.child_id);
    }

    return updatedRecord;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除报读记录失败: ${error.message}`);
  }
}