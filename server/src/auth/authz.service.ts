import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 通用鉴权辅助服务：
 * 基于 JWT 中的 userId（users.id）查询真实角色与资源归属关系，
 * 供各业务 service 做资源级归属校验（fail-closed：查不到即拒绝）。
 */
@Injectable()
export class AuthzService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 查询用户所有 active 角色（user_roles）
   */
  async getUserRoles(userId: string): Promise<Array<{ id: string; user_id: string; role_type: string; status: string }>> {
    if (!userId) return [];
    const { data, error } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('[AuthzService] getUserRoles 查询失败:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * 取用户最高优先级角色：superadmin > admin > teacher > parent；无 active 角色返回 'none'
   */
  async getRoleLevel(userId: string): Promise<string> {
    const roles = await this.getUserRoles(userId);
    if (roles.some(r => r.role_type === 'superadmin')) return 'superadmin';
    if (roles.some(r => r.role_type === 'admin')) return 'admin';
    if (roles.some(r => r.role_type === 'teacher')) return 'teacher';
    if (roles.some(r => r.role_type === 'parent')) return 'parent';
    return 'none';
  }

  /**
   * 家长可见幼儿 ID 集合：
   * user_roles(parent) -> parent_child_relations.parent_role_id -> child_id（去重）
   */
  async getParentChildIds(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const parentRoleIds = roles.filter(r => r.role_type === 'parent').map(r => r.id);
    if (parentRoleIds.length === 0) return [];

    const { data, error } = await this.client
      .from('parent_child_relations')
      .select('child_id')
      .in('parent_role_id', parentRoleIds);

    if (error) {
      console.error('[AuthzService] getParentChildIds 查询失败:', error.message);
      return [];
    }
    return [...new Set((data || []).map(r => r.child_id).filter(Boolean))];
  }

  /** 代理家长模式：超管以指定幼儿身份查看（agentChildId 存在且调用者为超管时直接放行该幼儿） */
  async getParentChildIdsAsAgent(userId: string, agentChildId?: string): Promise<string[]> {
    if (agentChildId) {
      const roles = await this.getUserRoles(userId);
      if (roles.some(r => r.role_type === 'superadmin')) return [agentChildId];
    }
    return this.getParentChildIds(userId);
  }

  /**
   * 教师可见班级 ID 集合：
   * teachers 表按 user_id 查 active 记录 -> class_id + teacher_classes 多班关联（去重并集）
   */
  async getTeacherClassIds(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('teachers')
      .select('id, class_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('[AuthzService] getTeacherClassIds 查询失败:', error.message);
      return [];
    }

    // teachers.class_id 兜底 + teacher_classes 多班关联并集
    const classIds = new Set<string>((data || []).map(t => t.class_id).filter(Boolean) as string[]);
    const teacherIds = (data || []).map(t => t.id).filter(Boolean);
    if (teacherIds.length > 0) {
      const { data: tcRows, error: tcError } = await this.client
        .from('teacher_classes')
        .select('class_id')
        .in('teacher_id', teacherIds);
      if (tcError) {
        console.warn('[AuthzService] teacher_classes 查询失败:', tcError.message);
      } else {
        for (const cid of (tcRows || []).map(r => r.class_id)) {
          if (cid) classIds.add(cid);
        }
      }
    }
    return [...classIds];
  }
}
