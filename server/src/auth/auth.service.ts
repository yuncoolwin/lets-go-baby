import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AuthService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 生成 Mock Token
   */
  private generateToken(roleId: string, roleType: string, phone: string): string {
    // 使用简单的 Base64 编码作为 Mock Token
    const payload = `${roleId}:${roleType}:${phone}:${Date.now()}`;
    return Buffer.from(payload).toString('base64');
  }

  /**
   * 微信登录（Mock模式）
   * 流程：微信授权 → 查users表 → 已注册则查角色 → 未注册则创建user+parent角色
   */
  async wxLogin(code: string, mockRole?: string) {
    console.log('[AuthService] wxLogin called:', { code: code?.substring(0, 10) + '...', mockRole });

    // 在真实环境中，这里会调用微信API获取openid
    // Mock模式：使用code作为openid
    const openid = `mock_openid_${code}`;
    console.log('[AuthService] Generated openid:', openid);

    // 1. 查找已有用户
    const { data: existingUser, error: findError } = await this.client
      .from('users')
      .select('id, openid, nickname, avatar_url, phone')
      .eq('openid', openid)
      .maybeSingle();

    if (findError) {
      console.error('[AuthService] Find user error:', findError);
    }
    console.log('[AuthService] Existing user:', existingUser ? `id=${existingUser.id}` : 'not found');

    let userId: string;
    let user: { id: string; openid: string; nickname: string; avatar_url: string | null; phone: string | null };

    if (existingUser) {
      // 已注册，直接使用
      userId = existingUser.id;
      user = existingUser;
      console.log('[AuthService] Using existing user:', userId);
    } else {
      // 未注册，创建新用户
      console.log('[AuthService] Creating new user with openid:', openid);
      const { data: newUser, error } = await this.client
        .from('users')
        .insert({
          openid,
          nickname: '新用户',
        })
        .select('id, openid, nickname, avatar_url, phone')
        .single();

      if (error) {
        console.error('[AuthService] Create user error:', error);
        // 如果是唯一约束冲突（并发情况），再次尝试查找用户
        if (error.code === '23505') {
          console.log('[AuthService] Unique constraint conflict, retrying find user...');
          const { data: retryUser, error: retryError } = await this.client
            .from('users')
            .select('id, openid, nickname, avatar_url, phone')
            .eq('openid', openid)
            .maybeSingle();

          if (retryError || !retryUser) {
            throw new Error(`查找用户失败: ${retryError?.message || '用户不存在'}`);
          }
          userId = retryUser.id;
          user = retryUser;
          console.log('[AuthService] Found user after retry:', userId);
        } else {
          throw new Error(`创建用户失败: ${error.message}`);
        }
      } else {
        userId = newUser.id;
        user = newUser;
        console.log('[AuthService] Created new user:', userId);

        // 自动创建parent角色
        const { error: roleError } = await this.client.from('user_roles').insert({
          user_id: userId,
          role_type: 'parent',
          status: 'active',
        });
        if (roleError) {
          console.error('[AuthService] Create parent role error:', roleError);
        }
      }
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
      birth_date: string | null;
      allergies: string | null;
      relationship: string;
    }> = [];

    const parentRole = activeRoles.find(r => r.role_type === 'parent');
    if (parentRole) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id, relationship, custom_relationship, status')
        .eq('parent_role_id', parentRole.id)
        .eq('status', 'approved');

      if (relations && relations.length > 0) {
        const childIds = relations.map(r => r.child_id);
        const { data: childData } = await this.client
          .from('children')
          .select('id, name, nickname, gender, avatar_url, birth_date, allergies')
          .in('id', childIds);

        if (childData) {
          children = childData.map(c => {
            const rel = relations.find(r => r.child_id === c.id);
            return {
              ...c,
              relationship: rel?.relationship || 'other',
              custom_relationship: rel?.custom_relationship || null,
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
      nickname?: string;
      gender: string;
      avatar_url: string | null;
      relationship: string;
    }> = [];

    const parentRole = (roles || []).find(r => r.role_type === 'parent');
    if (parentRole) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id, relationship, custom_relationship')
        .eq('parent_role_id', parentRole.id)
        .eq('status', 'approved');

      if (relations && relations.length > 0) {
        const childIds = relations.map(r => r.child_id);
        const { data: childData } = await this.client
          .from('children')
          .select('id, name, nickname, gender, avatar_url, birth_date, allergies')
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
   * Mock教师登录：通过手机号查找教师
   */
  async teacherLoginByPhone(phone: string) {
    const supabase = getSupabaseClient();

    // 特殊手机号 13800001111 -> 登录为"秋秋老师"
    const MOCK_TEACHER_MAP: Record<string, string> = {
      '13800001111': '黄秋莹', // 昵称: 秋秋老师
    };

    const teacherRealName = MOCK_TEACHER_MAP[phone];
    if (!teacherRealName) {
      throw new Error('无效的教师手机号');
    }

    // 查找教师
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id, real_name, nickname, title, class_id')
      .eq('real_name', teacherRealName)
      .eq('status', 'active')
      .single();

    if (teacherError || !teacher) {
      throw new Error('未找到该教师');
    }

    // 确保 users 表中有对应用户（通过手机号查找或创建）
    let { data: user } = await supabase
      .from('users')
      .select('id, nickname, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          openid: `teacher_${phone}`,
          nickname: teacherRealName,
          phone,
        })
        .select()
        .single();
      if (userError) {
        console.error('[teacherLoginByPhone] Create user error:', userError);
        throw new Error(`创建用户失败: ${userError.message}`);
      }
      user = newUser;
    }

    // 查找或创建对应的 user_role
    let { data: role } = await supabase
      .from('user_roles')
      .select('id, real_name, role_type')
      .eq('role_type', 'teacher')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!role) {
      console.log('[teacherLoginByPhone] Role not found, creating new role for user:', user!.id);
      const { data: newRole, error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user!.id,
          real_name: teacherRealName,
          role_type: 'teacher',
          status: 'active',
        })
        .select()
        .single();
      if (insertError) {
        console.error('[teacherLoginByPhone] Insert role error:', insertError);
        throw new Error(`创建教师角色失败: ${insertError.message}`);
      }
      console.log('[teacherLoginByPhone] Created role:', newRole);
      role = newRole;
    }

    if (!role) {
      throw new Error('无法创建教师角色');
    }

    // 生成token
    const token = this.generateToken(role.id, role.role_type, phone);

    // 查找班级名称
    let className = '';
    if (teacher.class_id) {
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', teacher.class_id)
        .maybeSingle();
      className = classData?.name || '';
    }

    return {
      token,
      user: {
        id: user!.id,
        real_name: teacherRealName,
        nickname: teacher.nickname,
        phone,
        role_type: 'teacher',
        teacher_id: teacher.id,
        title: teacher.title || '',
        class_id: teacher.class_id || '',
        class_name: className,
      },
    };
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
