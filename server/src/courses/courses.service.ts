import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class CoursesService {
  private supabase = getSupabaseClient();

  async findAll(weekday?: string) {
    let query = this.supabase
      .from('courses')
      .select('*')

    // 根据星期过滤课程
    if (weekday !== undefined && weekday !== '') {
      const wd = parseInt(weekday, 10)
      if (wd >= 1 && wd <= 5) {
        // 周一至周五 → 只显示工作日课程
        query = query.eq('date_calc_rule', '工作日')
      } else if (wd === 6) {
        // 周六 → 只显示周六课程
        query = query.eq('date_calc_rule', '周六')
      } else if (wd === 0) {
        // 周日 → 只显示周日课程
        query = query.eq('date_calc_rule', '周日')
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
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
    // 如果尝试停用，检查是否有进行中的报读记录
    if (body.status === '停用') {
      const { data: activeEnrollments, error: queryError } = await this.supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', id)
        .eq('status', '进行中')
        .limit(1);
      if (queryError) throw new Error(queryError.message);

      if (activeEnrollments && activeEnrollments.length > 0) {
        return { success: false, message: '该课程下有在读幼儿，无法停用' };
      }
    }

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

  async remove(id: string, operatorUserId?: string, operatorRoleId?: string) {
    // 权限校验：仅超管可删除课程
    let operatorRoleType: string | null = null;
    if (operatorRoleId) {
      const { data: roleData } = await this.supabase
        .from('user_roles')
        .select('id, role_type')
        .eq('id', operatorRoleId)
        .maybeSingle();
      operatorRoleType = roleData?.role_type || null;
    }
    if (operatorRoleType !== 'superadmin') {
      return { success: false, code: 403, message: '仅超级管理员可删除课程' };
    }

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

    const { error: logErr } = await this.supabase.from('audit_logs').insert({
      user_id: operatorUserId || null,
      user_role_id: operatorRoleId || null,
      action: 'course_delete',
      target_type: 'course',
      target_id: id,
      level: 'warn',
      created_at: new Date().toISOString(),
    });
    if (logErr) console.warn('[audit-log] course_delete 写入失败:', logErr.message);

    return { success: true, message: '删除成功' };
  }
}