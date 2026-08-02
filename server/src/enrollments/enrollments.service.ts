import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface Enrollment {
  id: string;
  child_id: string;
  course_type: string;
  duration_type: string;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentDto {
  child_id: string;
  course_type: string;
  duration_type: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface UpdateEnrollmentDto {
  course_type?: string;
  duration_type?: string;
  duration_days?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
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
    const { data, error } = await this.client
      .from('enrollments')
      .insert({
        child_id: dto.child_id,
        course_type: dto.course_type || '',
        duration_type: dto.duration_type || '',
        duration_days: dto.duration_days || 0,
        start_date: dto.start_date || null,
        end_date: dto.end_date || null,
        status: dto.status || '进行中',
      })
      .select()
      .single();

    if (error) throw new Error(`创建报读记录失败: ${error.message}`);
    return data;
  }

  async update(id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const updateData: Record<string, any> = {};
    if (dto.course_type !== undefined) updateData.course_type = dto.course_type;
    if (dto.duration_type !== undefined) updateData.duration_type = dto.duration_type;
    if (dto.duration_days !== undefined) updateData.duration_days = dto.duration_days;
    if (dto.start_date !== undefined) updateData.start_date = dto.start_date;
    if (dto.end_date !== undefined) updateData.end_date = dto.end_date;
    if (dto.status !== undefined) updateData.status = dto.status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from('enrollments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新报读记录失败: ${error.message}`);
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