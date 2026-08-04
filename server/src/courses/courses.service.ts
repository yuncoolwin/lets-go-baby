import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class CoursesService {
  private supabase = getSupabaseClient();

  async findAll() {
    const { data, error } = await this.supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async create(body: { name: string; class_id?: string; duration_options?: string[]; date_calc_rule?: string; status?: string }) {
    const { data, error } = await this.supabase
      .from('courses')
      .insert({
        name: body.name,
        class_id: body.class_id || null,
        duration_options: body.duration_options || [],
        date_calc_rule: body.date_calc_rule || '工作日',
        status: body.status || '启用',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, body: any) {
    const { data, error } = await this.supabase
      .from('courses')
      .update({
        name: body.name,
        class_id: body.class_id,
        duration_options: body.duration_options,
        date_calc_rule: body.date_calc_rule,
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async remove(id: string) {
    // 检查是否有进行中的报读记录
    const { data: activeEnrollments, error: queryError } = await this.supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', id)
      .eq('status', '进行中')
      .limit(1);
    if (queryError) throw new Error(queryError.message);

    if (activeEnrollments && activeEnrollments.length > 0) {
      return { success: false, message: '该课程下有在读幼儿，无法删除' };
    }

    // 仅删除课程本身，不级联删除历史报读记录
    const { error } = await this.supabase
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true, message: '删除成功' };
  }
}