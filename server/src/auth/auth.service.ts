import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AuthService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 微信登录（Mock模式）
   * 流程：微信授权 → 查users表 → 已注册则查角色 → 未注册则创建user+parent角色
   */
  async wxLogin(code: string, mockRole?: string) {
    // 在真实环境中，这里会调用微信API获取openid
    // Mock模式：使用code作为openid
    const openid = `mock_openid_${code}`;

    // 1. 查找已有用户
    const { data: existingUser } = await this.client
      .from('users')
      .select('id, openid, nickname, avatar_url, phone')
      .eq('openid', openid)
      .maybeSingle();

    let userId: string;
    let user: { id: string; openid: string; nickname: string; avatar_url: string | null; phone: string | null };

    if (existingUser) {
      // 已注册，直接使用
      userId = existingUser.id;
      user = existingUser;
    } else {
      // 未注册，创建新用户
      const { data: newUser, error } = await this.client
        .from('users')
        .insert({
          openid,
          nickname: '新用户',
        })
        .select('id, openid, nickname, avatar_url, phone')
        .single();

      if (error) throw new Error(`创建用户失败: ${error.message}`);
      userId = newUser.id;
      user = newUser;

      // 自动创建parent角色
      await this.client.from('user_roles').insert({
        user_id: userId,
        role_type: 'parent',
        status: 'active',
      });
    }

    // 2. 处理 mock 角色（测试用）
    if (mockRole && mockRole !== 'parent') {
      // 检查是否已有该角色
      const { data: existingRole } = await this.client
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_type', mockRole)
        .maybeSingle();

      if (!existingRole) {
        // 创建 mock 角色
        await this.client.from('user_roles').insert({
          user_id: userId,
          role_type: mockRole,
          status: 'active',
          real_name: `测试${mockRole === 'teacher' ? '教师' : '管理员'}`,
        });
      }
    }

    // 3. 获取用户所有角色
    const { data: roles, error: rolesError } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (rolesError) throw new Error(`查询角色失败: ${rolesError.message}`);

    // 4. 确定登录目标
    const activeRoles = roles || [];
    let targetRole: string | null = null;
    let needRoleSelection = false;

    if (mockRole) {
      // 指定角色登录（测试用）
      targetRole = mockRole;
    } else if (activeRoles.length === 1) {
      targetRole = activeRoles[0].role_type;
    } else if (activeRoles.length > 1) {
      // 多角色，需要用户选择
      needRoleSelection = true;
    }

    // 4. 获取家长绑定的孩子信息
    let children: Array<{
      id: string;
      name: string;
      gender: string;
      avatar_url: string | null;
      relationship: string;
    }> = [];

    const parentRole = activeRoles.find(r => r.role_type === 'parent');
    if (parentRole) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id, relationship, status')
        .eq('parent_role_id', parentRole.id)
        .eq('status', 'approved');

      if (relations && relations.length > 0) {
        const childIds = relations.map(r => r.child_id);
        const { data: childData } = await this.client
          .from('children')
          .select('id, name, gender, avatar_url')
          .in('id', childIds);

        if (childData) {
          children = childData.map(c => {
            const rel = relations.find(r => r.child_id === c.id);
            return {
              ...c,
              relationship: rel?.relationship || 'other',
            };
          });
        }
      }
    }

    return {
      user,
      roles: activeRoles,
      target_role: targetRole,
      need_role_selection: needRoleSelection,
      children,
      has_bound_children: children.length > 0,
    };
  }

  /**
   * 获取用户信息（已登录状态）
   */
  async getUserInfo(userId: string) {
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('id, nickname, avatar_url, phone')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw new Error(`查询用户失败: ${userError.message}`);
    if (!user) throw new Error('用户不存在');

    const { data: roles } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    // 获取孩子信息
    let children: Array<{
      id: string;
      name: string;
      gender: string;
      avatar_url: string | null;
      relationship: string;
    }> = [];

    const parentRole = (roles || []).find(r => r.role_type === 'parent');
    if (parentRole) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id, relationship')
        .eq('parent_role_id', parentRole.id)
        .eq('status', 'approved');

      if (relations && relations.length > 0) {
        const childIds = relations.map(r => r.child_id);
        const { data: childData } = await this.client
          .from('children')
          .select('id, name, gender, avatar_url')
          .in('id', childIds);

        if (childData) {
          children = childData.map(c => {
            const rel = relations.find(r => r.child_id === c.id);
            return {
              ...c,
              relationship: rel?.relationship || 'other',
            };
          });
        }
      }
    }

    return {
      user,
      roles: roles || [],
      children,
    };
  }

  /**
   * 选择角色（多角色用户）
   */
  async selectRole(userId: string, roleType: string) {
    const { data: role } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('user_id', userId)
      .eq('role_type', roleType)
      .eq('status', 'active')
      .maybeSingle();

    if (!role) throw new Error('角色不存在或已禁用');

    return { role };
  }

  /**
   * 生成教师邀请码（管理员功能）
   */
  async generateInviteCode(adminRoleId: string) {
    // 生成6位随机邀请码
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 在实际应用中，应该将邀请码存储到数据库
    // 这里简化处理，直接返回
    return {
      invite_code: code,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天有效
    };
  }

  /**
   * 使用邀请码注册教师
   */
  async registerTeacher(userId: string, inviteCode: string, realName: string) {
    // 在实际应用中，应该验证邀请码是否有效
    // 这里简化处理，直接创建教师角色

    // 检查是否已有教师角色
    const { data: existingRole } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_type', 'teacher')
      .maybeSingle();

    if (existingRole) {
      throw new Error('您已经是教师角色');
    }

    // 创建教师角色
    const { data: newRole, error } = await this.client
      .from('user_roles')
      .insert({
        user_id: userId,
        role_type: 'teacher',
        real_name: realName,
        status: 'active',
      })
      .select('id, user_id, role_type, real_name, status')
      .single();

    if (error) throw new Error(`创建教师角色失败: ${error.message}`);

    // 更新用户昵称
    await this.client
      .from('users')
      .update({ nickname: realName })
      .eq('id', userId);

    return { role: newRole };
  }
}
