import { Injectable, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { AuthzService } from '@/auth/authz.service';

@Injectable()
export class CoursesService {
  constructor(private readonly authz: AuthzService) {}

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

  /** 写审计日志：失败仅告警，不阻断主流程 */
  private async logAudit(params: {
    userId: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    name?: string | null;
    level?: string;
  }) {
    try {
      const { error } = await this.supabase.from('audit_logs').insert({
        user_id: params.userId || null,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId || null,
        detail: { name: params.name || null },
        level: params.level || 'info',
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('[AuditLog] 写入失败:', error.message);
    } catch (e) {
      console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
    }
  }

  async create(userId: string, body: { name: string; class_id?: string; duration_options?: string[]; date_calc_rule?: string; status?: string }) {
    // 权限校验：仅管理员及以上可创建课程
    const level = await this.authz.getRoleLevel(userId);
    if (!['admin', 'superadmin'].includes(level)) {
      throw new ForbiddenException('仅管理员可创建课程');
    }

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
    await this.logAudit({ userId, action: 'course_create', targetType: 'course', targetId: data?.id || null, name: data?.name || null });
    return data;
  }

  async update(userId: string, id: string, body: any) {
    // 权限校验：仅管理员及以上可更新课程
    const level = await this.authz.getRoleLevel(userId);
    if (!['admin', 'superadmin'].includes(level)) {
      throw new ForbiddenException('仅管理员可更新课程');
    }

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
    await this.logAudit({ userId, action: 'course_update', targetType: 'course', targetId: id, name: data?.name || null });
    return data;
  }

  async remove(userId: string, id: string) {
    // 权限校验：仅超管可删除课程
    const level = await this.authz.getRoleLevel(userId);
    if (level !== 'superadmin') {
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
      user_id: userId || null,
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