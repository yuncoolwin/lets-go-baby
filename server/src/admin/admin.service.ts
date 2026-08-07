import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AdminService {
  private get client() {
    return getSupabaseClient();
  }

  async getPendingCount() {
    const { count, error } = await this.client
      .from('binding_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw new Error(`查询失败: ${error.message}`);
    return { count: count || 0 };
  }

  async getBindingRequests() {
    // 从数据库查询所有绑定请求（包括 pending、approved、rejected）
    const { data, error } = await this.client
      .from('binding_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    // 逐条获取关联的幼儿和家长信息
    const results: Array<{
      id: string;
      parent_name: string;
      child_name: string;
      relationship: string;
      custom_relationship: string | null;
      status: string;
      reject_reason: string | null;
      created_at: string;
      approved_at: string | null;
    }> = [];
    for (const req of (data || [])) {
      let childName = req.child_name || '未知幼儿';
      let parentName = '未知用户';

      // 通过 child_id 获取幼儿姓名
      if (req.child_id) {
        const { data: child } = await this.client
          .from('children')
          .select('name')
          .eq('id', req.child_id)
          .maybeSingle();
        if (child) childName = child.name;
      }

      // 通过 parent_role_id 关联 user_id 获取家长昵称
      if (req.parent_role_id) {
        const { data: role } = await this.client
          .from('user_roles')
          .select('user_id')
          .eq('id', req.parent_role_id)
          .maybeSingle();
        if (role?.user_id) {
          const { data: user } = await this.client
            .from('users')
            .select('nickname')
            .eq('id', role.user_id)
            .maybeSingle();
          if (user) parentName = user.nickname || '未知用户';
        }
      }

      results.push({
        id: req.id,
        parent_name: parentName,
        child_name: childName,
        relationship: req.relationship,
        custom_relationship: req.custom_relationship,
        status: req.status,
        reject_reason: req.reject_reason,
        created_at: req.created_at,
        approved_at: req.reviewed_at || req.approved_at,
      });
    }

    return results;
  }

  async getPendingBindingRequests() {
    // 只查询 pending 状态的记录
    const { data, error } = await this.client
      .from('binding_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    // 逐条获取关联的幼儿和家长信息
    const results: Array<{
      id: string;
      parent_name: string;
      child_name: string;
      relationship: string;
      custom_relationship: string | null;
      status: string;
      reject_reason: string | null;
      created_at: string;
      approved_at: string | null;
    }> = [];
    for (const req of (data || [])) {
      let childName = req.child_name || '未知幼儿';
      let parentName = '未知用户';

      // 通过 child_id 获取幼儿姓名
      if (req.child_id) {
        const { data: child } = await this.client
          .from('children')
          .select('name')
          .eq('id', req.child_id)
          .maybeSingle();
        if (child) childName = child.name;
      }

      // 通过 parent_role_id 关联 user_id 获取家长昵称
      if (req.parent_role_id) {
        const { data: role } = await this.client
          .from('user_roles')
          .select('user_id')
          .eq('id', req.parent_role_id)
          .maybeSingle();
        if (role?.user_id) {
          const { data: user } = await this.client
            .from('users')
            .select('nickname')
            .eq('id', role.user_id)
            .maybeSingle();
          if (user) parentName = user.nickname || '未知用户';
        }
      }

      results.push({
        id: req.id,
        parent_name: parentName,
        child_name: childName,
        relationship: req.relationship,
        custom_relationship: req.custom_relationship,
        status: req.status,
        reject_reason: req.reject_reason,
        created_at: req.created_at,
        approved_at: req.reviewed_at || req.approved_at,
      });
    }

    return results;
  }

  async approveBindingRequest(requestId: string) {
    // 1. 先获取绑定请求的完整信息
    const { data: request, error: reqError } = await this.client
      .from('binding_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      throw new Error(`绑定请求不存在: ${reqError?.message || '未找到'}`);
    }

    // 2. 同步家长提交的幼儿信息到 children 表
    const updateChildData: Record<string, any> = {};
    if (request.nickname) updateChildData.nickname = request.nickname;
    if (request.allergies) updateChildData.allergies = request.allergies;

    if (request.child_id && Object.keys(updateChildData).length > 0) {
      const { error: childError } = await this.client
        .from('children')
        .update(updateChildData)
        .eq('id', request.child_id);

      if (childError) {
        console.error(`[Admin] 同步幼儿信息失败: ${childError.message}`);
        // 不阻断流程，继续执行
      } else {
        console.log(`[Admin] 同步幼儿信息成功: child_id=${request.child_id}`, updateChildData);
      }
    }

    // 3. 更新 binding_requests 状态为 approved
    const { error } = await this.client
      .from('binding_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);

    // 4. 从 user_roles 表获取 user_id
    let userId: string | null = null;
    if (request.parent_role_id) {
      const { data: role } = await this.client
        .from('user_roles')
        .select('user_id')
        .eq('id', request.parent_role_id)
        .maybeSingle();
      if (role) userId = role.user_id;
    }

    // 4. 在 parent_child_relations 表中创建记录
    if (userId && request.child_id) {
      const { error: relError } = await this.client
        .from('parent_child_relations')
        .insert({
          user_id: userId,
          parent_role_id: request.parent_role_id,
          child_id: request.child_id,
          relationship: request.relationship,
          custom_relationship: request.custom_relationship || null,
          is_primary: true,
          status: 'approved',
          approved_at: new Date().toISOString(),
        });

      if (relError) throw new Error(`创建绑定关系失败: ${relError.message}`);
    }

    return { success: true };
  }

  async rejectBindingRequest(requestId: string, reason?: string) {
    const updateData: any = {
      status: 'rejected',
      approved_at: new Date().toISOString(),
    };
    if (reason) {
      updateData.reject_reason = reason;
    }

    const { error } = await this.client
      .from('binding_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);
    return { success: true };
  }
}
