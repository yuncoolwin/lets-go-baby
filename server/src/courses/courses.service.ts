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
    const { error } = await this.supabase
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}