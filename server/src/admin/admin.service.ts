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

  async approveBindingRequest(requestId: string, operatorUserId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

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

    // 3. 从 user_roles 表获取 user_id
    let userId: string | null = null;
    if (request.parent_role_id) {
      const { data: role } = await this.client
        .from('user_roles')
        .select('user_id')
        .eq('id', request.parent_role_id)
        .maybeSingle();
      if (role) userId = role.user_id;
    }

    // 4. 确保用户有 parent 角色（如没有则自动创建）
    let parentRoleId = request.parent_role_id;
    if (userId) {
      const roleType = request.parent_role_id
        ? (await this.client.from('user_roles').select('role_type').eq('id', request.parent_role_id).maybeSingle()).data
            ?.role_type
        : null;
      // 如果当前角色不是 parent，查找或创建 parent 角色
      if (roleType !== 'parent') {
        const { data: existingParent } = await this.client
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role_type', 'parent')
          .maybeSingle();

        if (existingParent) {
          parentRoleId = existingParent.id;
        } else {
          const { data: newRole, error: createError } = await this.client
            .from('user_roles')
            .insert({
              user_id: userId,
              role_type: 'parent',
              status: 'active',
            })
            .select('id')
            .single();
          if (createError) throw new Error(`创建家长角色失败: ${createError.message}`);
          if (newRole) parentRoleId = newRole.id;
        }
      }
    }

    // 5. 先删除旧绑定关系（避免唯一约束冲突），再插入新记录
    if (userId && request.child_id) {
      // 先删除可能存在的旧绑定记录
      await this.client
        .from('parent_child_relations')
        .delete()
        .eq('parent_role_id', parentRoleId)
        .eq('child_id', request.child_id);

      // 插入新绑定记录
      const { error: relError } = await this.client
        .from('parent_child_relations')
        .insert({
          user_id: userId,
          parent_role_id: parentRoleId,
          child_id: request.child_id,
          relationship: request.relationship,
          custom_relationship: request.custom_relationship || null,
          is_primary: true,
          status: 'active',
          approved_at: new Date().toISOString(),
        });

      if (relError) throw new Error(`创建绑定关系失败: ${relError.message}`);
    }

    // 6. 所有步骤成功后，最后更新 binding_requests 状态为 approved
    const { error } = await this.client
      .from('binding_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'binding_approve',
      target_type: 'binding_request',
      target_id: requestId,
    });

    return { code: 200, msg: 'success', data: { success: true } };
  }

  async getChildParents(childId: string) {
    // 查询该幼儿的所有已绑定家长
    const { data: relations, error } = await this.client
      .from('parent_child_relations')
      .select('id, user_id, parent_role_id, relationship, custom_relationship')
      .eq('child_id', childId)
      .eq('status', 'active');

    if (error) throw new Error(`查询失败: ${error.message}`);

    const results: Array<{
      id: string;
      parent_name: string;
      relationship: string;
    }> = [];

    for (const rel of (relations || [])) {
      let parentName = '未知家长';

      // 通过 user_id 获取家长昵称
      if (rel.user_id) {
        const { data: user } = await this.client
          .from('users')
          .select('nickname')
          .eq('id', rel.user_id)
          .maybeSingle();
        if (user?.nickname) parentName = user.nickname;
      }

      // 构建显示名称
      const child = await this.client
        .from('children')
        .select('name')
        .eq('id', childId)
        .maybeSingle();
      const childName = child.data?.name || '';

      const relationshipLabel = this.getRelationshipLabel(rel.relationship, rel.custom_relationship);
      const displayName = childName ? `${childName}${relationshipLabel}` : relationshipLabel;

      results.push({
        id: rel.id,
        parent_name: parentName,
        relationship: displayName,
      });
    }

    return results;
  }

  async removeParentBinding(childId: string, relationId: string) {
    // 1. 先获取关联记录，找到 parent_role_id
    const { data: relation, error: fetchError } = await this.client
      .from('parent_child_relations')
      .select('parent_role_id')
      .eq('id', relationId)
      .eq('child_id', childId)
      .single();

    if (fetchError || !relation) {
      throw new Error(`关联记录不存在: ${fetchError?.message || '未找到'}`);
    }

    // 2. 删除关联记录
    const { error: deleteError } = await this.client
      .from('parent_child_relations')
      .delete()
      .eq('id', relationId)
      .eq('child_id', childId);

    if (deleteError) throw new Error(`解除绑定失败: ${deleteError.message}`);

    // 3. 将 binding_requests 中对应的已审核记录标记为 unbound，允许家长重新申请
    const { error: updateError } = await this.client
      .from('binding_requests')
      .update({ status: 'unbound', approved_at: null })
      .eq('parent_role_id', relation.parent_role_id)
      .eq('child_id', childId)
      .eq('status', 'approved');

    if (updateError) {
      console.error(`[removeParentBinding] 更新绑定请求状态失败: ${updateError.message}`);
    }

    return { success: true };
  }

  async getParentStatus(userId: string): Promise<{ hasParentRole: boolean; childCount: number }> {
    // 1. 查找该用户的 parent 角色
    console.log('[getParentStatus] userId:', userId);
    const { data: parentRole, error: parentRoleError } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_type', 'parent')
      .maybeSingle();
    console.log('[getParentStatus] parentRole:', parentRole, 'error:', parentRoleError);

    if (!parentRole) {
      return { hasParentRole: false, childCount: 0 };
    }

    // 2. 统计该 parent 角色下的绑定幼儿数量
    const { count } = await this.client
      .from('parent_child_relations')
      .select('*', { count: 'exact', head: true })
      .eq('parent_role_id', parentRole.id);

    return { hasParentRole: true, childCount: count || 0 };
  }

  private getRelationshipLabel(relationship: string, customRelationship?: string | null): string {
    if (relationship === 'other' && customRelationship) {
      return customRelationship;
    }
    const map: Record<string, string> = {
      father: '爸爸',
      mother: '妈妈',
      grandfather: '爷爷',
      grandmother: '奶奶',
      other: '其他',
    };
    return map[relationship] || relationship;
  }

  async rejectBindingRequest(requestId: string, reason: string | undefined, operatorUserId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

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

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'binding_reject',
      target_type: 'binding_request',
      target_id: requestId,
      detail: { reason: reason || '' },
    });

    return { code: 200, msg: 'success', data: { success: true } };
  }

  async deleteBindingRequest(requestId: string) {
    const { data: request } = await this.client
      .from('binding_requests')
      .select('id')
      .eq('id', requestId)
      .maybeSingle();
    if (!request) return { code: 404, msg: '申请不存在', data: null };

    const { error } = await this.client.from('binding_requests').delete().eq('id', requestId);
    if (error) throw new Error(`删除失败: ${error.message}`);
    return { code: 200, msg: 'success', data: { success: true } };
  }

  async updateBindingRequest(requestId: string, relationship?: string, customRelationship?: string) {
    const { data: existing } = await this.client
      .from('binding_requests')
      .select('id')
      .eq('id', requestId)
      .maybeSingle();
    if (!existing) return { code: 404, msg: '申请不存在', data: null };

    const updateData: Record<string, any> = {};
    if (relationship !== undefined) updateData.relationship = relationship;
    if (customRelationship !== undefined) updateData.custom_relationship = customRelationship;

    const { error } = await this.client
      .from('binding_requests')
      .update(updateData)
      .eq('id', requestId);
    if (error) throw new Error(`更新失败: ${error.message}`);

    // 同步已建立的家长-幼儿绑定关系（若该申请已审核通过）
    const { data: request } = await this.client
      .from('binding_requests')
      .select('parent_role_id, child_id')
      .eq('id', requestId)
      .maybeSingle();
    if (request?.parent_role_id && request?.child_id) {
      const relUpdate: Record<string, any> = {};
      if (relationship !== undefined) relUpdate.relationship = relationship;
      if (customRelationship !== undefined) relUpdate.custom_relationship = customRelationship;
      await this.client
        .from('parent_child_relations')
        .update(relUpdate)
        .eq('parent_role_id', request.parent_role_id)
        .eq('child_id', request.child_id);
    }

    return { code: 200, msg: 'success', data: { success: true } };
  }

  // 切换审核申请状态（通过 ↔ 拒绝）
  async setBindingRequestStatus(requestId: string, status: string, operatorUserId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    if (status === 'approved') {
      return this.approveBindingRequest(requestId, operatorUserId);
    }

    if (status === 'rejected') {
      const { data: request, error: reqError } = await this.client
        .from('binding_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (reqError || !request) {
        return { code: 404, msg: '审核申请不存在', data: null };
      }

      // 先解析 user_id（与 approve 逻辑一致），再按 user_id + child_id 删除实际绑定关系
      let userId: string | null = null;
      if (request.parent_role_id) {
        const { data: role } = await this.client
          .from('user_roles')
          .select('user_id')
          .eq('id', request.parent_role_id)
          .maybeSingle();
        if (role) userId = role.user_id;
      }

      if (userId && request.child_id) {
        await this.client
          .from('parent_child_relations')
          .delete()
          .eq('user_id', userId)
          .eq('child_id', request.child_id);
      }

      const { error } = await this.client
        .from('binding_requests')
        .update({
          status: 'rejected',
          approved_at: null,
        })
        .eq('id', requestId);

      if (error) throw new Error(`切换状态失败: ${error.message}`);

      await this.writeAuditLog({
        user_id: operatorUserId,
        user_role_id: isSuperAdmin.id,
        action: 'binding_reject',
        target_type: 'binding_request',
        target_id: requestId,
        detail: { status },
      });

      return { code: 200, msg: 'success', data: { success: true } };
    }

    return { code: 400, msg: '无效状态', data: null };
  }

  // 校验操作者是否为 active 超管，返回 user_role 记录或 null
  private async getActiveSuperAdmin(operatorUserId: string) {
    const { data, error } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', operatorUserId)
      .eq('role_type', 'superadmin')
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw new Error(`权限校验失败: ${error.message}`);
    return data || null;
  }

  // 操作日志写入（失败仅告警，不阻断主流程）
  async writeAuditLog(payload: {
    user_id?: string;
    user_role_id?: string;
    action: string;
    target_type?: string;
    target_id?: string;
    detail?: any;
    level?: string;
  }) {
    try {
      const { error } = await this.client.from('audit_logs').insert({
        ...payload,
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.warn('[audit-log] 写入失败:', error.message);
      }
    } catch (err) {
      console.warn('[audit-log] 写入异常:', err);
    }
  }

  // 返回系统全部用户及各自 active 角色
  async getPermissionUsers(operatorUserId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    const { data: users, error: usersError } = await this.client
      .from('users')
      .select('id, nickname, phone, avatar_url');

    if (usersError) throw new Error(`查询用户失败: ${usersError.message}`);

    const { data: roles, error: rolesError } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('status', 'active');

    if (rolesError) throw new Error(`查询角色失败: ${rolesError.message}`);

    const roleMap = new Map<string, any[]>();
    (roles || []).forEach((role: any) => {
      const list = roleMap.get(role.user_id) || [];
      list.push({
        id: role.id,
        role_type: role.role_type,
        real_name: role.real_name,
        status: role.status,
      });
      roleMap.set(role.user_id, list);
    });

    // 查询 active 的家长绑定关系，用于过滤「有 parent 角色且有绑定」的用户
    const { data: relations, error: relationsError } = await this.client
      .from('parent_child_relations')
      .select('parent_role_id')
      .eq('status', 'active');

    if (relationsError) {
      throw new Error(`查询家长绑定关系失败: ${relationsError.message}`);
    }

    const boundParentRoleIds = new Set<string>();
    (relations || []).forEach((rel: any) => boundParentRoleIds.add(rel.parent_role_id));

    const MANAGE_ROLE_TYPES = ['teacher', 'admin', 'superadmin'];
    const MANAGE_ROLE_PRIORITY = ['superadmin', 'admin', 'teacher'];

    const list: any[] = [];
    for (const user of users || []) {
      const userRoles = roleMap.get(user.id) || [];
      const hasManageRole = userRoles.some((r: any) => MANAGE_ROLE_TYPES.includes(r.role_type));
      const parentRoles = userRoles.filter((r: any) => r.role_type === 'parent');
      const isParentWithBinding = parentRoles.some((r: any) => boundParentRoleIds.has(r.id));

      const hasAnyActiveRole = userRoles.length > 0;

      // 过滤：隐藏「只有 parent 角色且没有任何 active 绑定关系」的用户
      if (hasAnyActiveRole && !hasManageRole && !isParentWithBinding) {
        continue;
      }

      // display_name：按 superadmin > admin > teacher 优先级取 real_name，否则 nickname
      let displayName: string = user.nickname || '';
      for (const rt of MANAGE_ROLE_PRIORITY) {
        const hit = userRoles.find((r: any) => r.role_type === rt && r.real_name);
        if (hit) {
          displayName = hit.real_name;
          break;
        }
      }

      list.push({
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        avatar_url: user.avatar_url,
        display_name: displayName,
        roles: userRoles,
      });
    }

    return { code: 200, msg: 'success', data: list };
  }

  // 给用户追加一条 active 角色
  async assignRole(operatorUserId: string, userId: string, roleType: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    if (!['teacher', 'admin', 'superadmin'].includes(roleType)) {
      return { code: 400, msg: '角色类型仅限 teacher/admin/superadmin', data: null };
    }

    const { data: user, error: userError } = await this.client
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw new Error(`查询用户失败: ${userError.message}`);
    if (!user) {
      return { code: 400, msg: '用户不存在', data: null };
    }

    const { data: existing, error: existingError } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_type', roleType)
      .eq('status', 'active')
      .maybeSingle();

    if (existingError) throw new Error(`查询角色失败: ${existingError.message}`);
    if (existing) {
      return { code: 200, msg: '该角色已存在', data: existing };
    }

    const { data: created, error: createError } = await this.client
      .from('user_roles')
      .insert({
        user_id: userId,
        role_type: roleType,
        real_name: user.nickname || '',
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select('id, user_id, role_type, real_name, status')
      .single();

    if (createError) throw new Error(`分配角色失败: ${createError.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'role_assign',
      target_type: 'user',
      target_id: userId,
      detail: { role_type: roleType },
    });

    return { code: 200, msg: 'success', data: created };
  }

  // 软删除角色
  async revokeRole(operatorUserId: string, userRoleId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    const { data: target, error: targetError } = await this.client
      .from('user_roles')
      .select('id, role_type, status')
      .eq('id', userRoleId)
      .maybeSingle();

    if (targetError) throw new Error(`查询角色失败: ${targetError.message}`);
    if (!target) {
      return { code: 400, msg: '角色不存在', data: null };
    }

    // 超管兜底：目标为 superadmin 时，至少保留一个 active 超管
    if (target.role_type === 'superadmin') {
      const { count, error: countError } = await this.client
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role_type', 'superadmin')
        .eq('status', 'active');

      if (countError) throw new Error(`统计超管失败: ${countError.message}`);
      if ((count || 0) <= 1) {
        return { code: 400, msg: '至少保留一个超管', data: null };
      }
    }

    const { error: revokeError } = await this.client
      .from('user_roles')
      .update({ status: 'inactive' })
      .eq('id', userRoleId);

    if (revokeError) throw new Error(`撤销角色失败: ${revokeError.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'role_revoke',
      target_type: 'user_role',
      target_id: userRoleId,
    });

    return { code: 200, msg: 'success', data: { success: true } };
  }

  // 新增用户
  async createPermissionUser(operatorUserId: string, nickname: string, phone: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    const { data: created, error } = await this.client
      .from('users')
      .insert({
        nickname: nickname || '',
        phone: phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, nickname, phone, avatar_url')
      .single();

    if (error) throw new Error(`新增用户失败: ${error.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'user_create',
      target_type: 'user',
      target_id: created.id,
    });

    return { code: 200, msg: 'success', data: created };
  }

  // 编辑用户
  async updatePermissionUser(operatorUserId: string, userId: string, nickname: string, phone: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    const { data: user, error: userError } = await this.client
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw new Error(`查询用户失败: ${userError.message}`);
    if (!user) {
      return { code: 400, msg: '用户不存在', data: null };
    }

    // 查 active 角色里 superadmin/admin/teacher 优先级最高的一条
    const MANAGE_ROLE_PRIORITY = ['superadmin', 'admin', 'teacher'];
    const { data: activeRoles, error: rolesError } = await this.client
      .from('user_roles')
      .select('id, role_type')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (rolesError) throw new Error(`查询角色失败: ${rolesError.message}`);

    let targetRoleId: string | null = null;
    for (const rt of MANAGE_ROLE_PRIORITY) {
      const hit = (activeRoles || []).find((r: any) => r.role_type === rt);
      if (hit) {
        targetRoleId = hit.id;
        break;
      }
    }

    // 用户名：有管理角色写 real_name，否则写 nickname
    if (targetRoleId) {
      const { error: roleUpdateError } = await this.client
        .from('user_roles')
        .update({ real_name: nickname || '' })
        .eq('id', targetRoleId);
      if (roleUpdateError) throw new Error(`更新角色真实姓名失败: ${roleUpdateError.message}`);
    }

    const userUpdatePayload: any = {
      phone: phone || null,
      updated_at: new Date().toISOString(),
    };
    if (!targetRoleId) {
      userUpdatePayload.nickname = nickname || '';
    }

    const { data: updated, error: updateError } = await this.client
      .from('users')
      .update(userUpdatePayload)
      .eq('id', userId)
      .select('id, nickname, phone, avatar_url')
      .single();

    if (updateError) throw new Error(`更新用户失败: ${updateError.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'user_update',
      target_type: 'user',
      target_id: userId,
    });

    return { code: 200, msg: 'success', data: updated };
  }

  // 删除用户（含保护检查）
  async deletePermissionUser(operatorUserId: string, userId: string) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    // 1. 家长绑定关系保护
    const { data: pcr, error: pcrError } = await this.client
      .from('parent_child_relations')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (pcrError) throw new Error(`查询家长绑定失败: ${pcrError.message}`);
    if (pcr) {
      return { code: 400, msg: '该用户存在家长绑定关系，无法删除', data: null };
    }

    // 2. 教师表保护
    const { data: teacher, error: teacherError } = await this.client
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (teacherError) throw new Error(`查询教师失败: ${teacherError.message}`);
    if (teacher) {
      return { code: 400, msg: '该用户是教师，无法删除', data: null };
    }

    // 3. 教师角色的成长记录引用保护
    const { data: teacherRoles, error: teacherRolesError } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_type', 'teacher');

    if (teacherRolesError) throw new Error(`查询教师角色失败: ${teacherRolesError.message}`);

    const teacherRoleIds = (teacherRoles || []).map((r: any) => r.id);
    if (teacherRoleIds.length > 0) {
      const { data: growth, error: growthError } = await this.client
        .from('growth_records')
        .select('id')
        .in('teacher_id', teacherRoleIds)
        .limit(1)
        .maybeSingle();

      if (growthError) throw new Error(`查询成长记录失败: ${growthError.message}`);
      if (growth) {
        return { code: 400, msg: '该教师存在成长记录，无法删除', data: null };
      }
    }

    // 4. 删除 user_roles 再删除 users
    const { error: deleteRolesError } = await this.client
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteRolesError) throw new Error(`删除角色失败: ${deleteRolesError.message}`);

    const { error: deleteUserError } = await this.client
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) throw new Error(`删除用户失败: ${deleteUserError.message}`);

    await this.writeAuditLog({
      user_id: operatorUserId,
      user_role_id: isSuperAdmin.id,
      action: 'user_delete',
      target_type: 'user',
      target_id: userId,
      level: 'warn',
    });

    return { code: 200, msg: 'success', data: { success: true } };
  }

  // 查询操作日志（超管）
  async getAuditLogs(
    operatorUserId: string,
    page: number,
    pageSize: number,
    action?: string,
    targetType?: string,
  ) {
    const isSuperAdmin = await this.getActiveSuperAdmin(operatorUserId);
    if (!isSuperAdmin) {
      return { code: 403, msg: '无权限', data: null };
    }

    let query = this.client
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (targetType) query = query.eq('target_type', targetType);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`查询日志失败: ${error.message}`);

    const list = data || [];

    // 批量查 users 昵称
    const userIds = [...new Set(list.map((l: any) => l.user_id).filter(Boolean))] as string[];
    const nicknameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await this.client
        .from('users')
        .select('id, nickname')
        .in('id', userIds);
      if (userErr) throw new Error(`查询用户失败: ${userErr.message}`);
      (users || []).forEach((u: any) => {
        nicknameMap[u.id] = u.nickname || '';
      });
    }

    const enriched = list.map((l: any) => ({
      ...l,
      operator_nickname: nicknameMap[l.user_id] || '',
    }));

    return {
      code: 200,
      msg: 'success',
      data: { list: enriched, total: count || 0 },
    };
  }
}
