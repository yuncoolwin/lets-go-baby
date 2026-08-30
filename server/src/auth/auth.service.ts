import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { WechatService } from './wechat.service';
import { signToken } from './jwt.util';

@Injectable()
export class AuthService {
  constructor(private readonly wechat: WechatService) {}

  private get client() {
    return getSupabaseClient();
  }

  /**
   * 生成 JWT（HS256，7 天有效期，payload 携带 userId）
   */
  private generateToken(userId: string): string {
    return signToken({ userId }, 7 * 24 * 3600);
  }

  /**
   * 微信登录
   * 流程：code 换 openid（MOCK_WECHAT=true 时为 mock）→ 查users表 → 已注册则查角色 → 未注册则创建user+parent角色
   */
  async wxLogin(code: string) {
    console.log('[AuthService] wxLogin called:', { code: code?.substring(0, 10) + '...' });

    // 通过微信服务换取 openid（MOCK_WECHAT=true 联调时返回 mock 值；否则要求真实 appid/secret 配置）
    let openid: string;
    try {
      openid = await this.wechat.getOpenidByCode(code);
    } catch (e: any) {
      console.log('[AuthService] wxLogin 配置错误:', e?.message);
      return { error: true, code: 503, msg: e?.message || '微信登录未配置，请联系管理员' };
    }
    console.log('[AuthService] Resolved openid:', openid?.substring(0, 8) + '...');

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

    const context = await this.getLoginContext(userId);
    return {
      user,
      token: this.generateToken(userId),
      ...context,
    };
  }

  // 组装登录上下文：查roles → 确定目标角色 → 查绑定孩子
  private async getLoginContext(userId: string) {
    // 获取用户所有角色
    const { data: roles, error: rolesError } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (rolesError) throw new Error(`查询角色失败: ${rolesError.message}`);

    // 确定登录目标
    const activeRoles = roles || [];
    let targetRole: string | null = null;
    let needRoleSelection = false;

    if (activeRoles.length === 1) {
      targetRole = activeRoles[0].role_type;
    } else if (activeRoles.length > 1) {
      // 多角色，需要用户选择
      needRoleSelection = true;
    }

    // 获取家长绑定的孩子信息
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
        .eq('status', 'active');

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
      roles: activeRoles,
      target_role: targetRole,
      need_role_selection: needRoleSelection,
      children,
      has_bound_children: children.length > 0,
    };
  }

  // 手机号登录：微信手机号授权 code + login code
  async phoneLogin(loginCode: string, phoneCode?: string) {
    console.log('[AuthService] phoneLogin 调用:', {
      loginCode: loginCode ? `${loginCode.slice(0, 10)}...` : loginCode,
      phoneCode: phoneCode ? '***' : undefined,
    });

    let openid: string;
    let phone: string | null;
    try {
      openid = await this.wechat.getOpenidByCode(loginCode);
      phone = phoneCode ? await this.wechat.getPhoneByCode(phoneCode) : null;
    } catch (e: any) {
      console.log('[AuthService] phoneLogin 配置错误:', e?.message);
      return { error: true, code: 503, msg: e?.message || '微信登录未配置，请联系管理员' };
    }
    console.log('[AuthService] phoneLogin 解析:', { openid, phone });

    let userId: string;
    let user: {
      id: string;
      openid: string;
      nickname: string;
      avatar_url: string | null;
      phone: string | null;
    };

    if (phone) {
      // a) 手机号非空：先按手机号查
      const { data: byPhone } = await this.client
        .from('users')
        .select('id, openid, nickname, avatar_url, phone')
        .eq('phone', phone)
        .maybeSingle();

      if (byPhone) {
        // 命中：合并 openid（若 openid 已被别行占用，先清空那一行）
        if (openid && openid !== byPhone.openid) {
          const { data: openidOwner } = await this.client
            .from('users')
            .select('id')
            .eq('openid', openid)
            .neq('id', byPhone.id)
            .maybeSingle();
          if (openidOwner) {
            await this.client.from('users').update({ openid: null }).eq('id', openidOwner.id);
          }
          await this.client.from('users').update({ openid }).eq('id', byPhone.id);
        }
        userId = byPhone.id;
        user = byPhone;
      } else if (openid) {
        // b) 手机号未命中，openid 有值：按 openid 查
        const { data: byOpenid } = await this.client
          .from('users')
          .select('id, openid, nickname, avatar_url, phone')
          .eq('openid', openid)
          .maybeSingle();

        if (byOpenid) {
          // openid 命中，把手机号更新进去（手机号已被别行占用则跳过）
          if (!byOpenid.phone || byOpenid.phone === phone) {
            await this.client.from('users').update({ phone }).eq('id', byOpenid.id);
          }
          userId = byOpenid.id;
          user = { ...byOpenid, phone };
        } else {
          // c) 都未命中：insert 用户 + parent 角色
          const { data: newUser, error } = await this.client
            .from('users')
            .insert({ openid, nickname: '新用户', phone })
            .select('id, openid, nickname, avatar_url, phone')
            .single();
          if (error) throw new Error(`创建用户失败: ${error.message}`);
          userId = newUser.id;
          user = newUser;
          await this.client.from('user_roles').insert({
            user_id: userId,
            role_type: 'parent',
            status: 'active',
          });
        }
      } else {
        // 手机号未命中且 openid 无值：insert 用户（无 openid）+ parent 角色
        const { data: newUser, error } = await this.client
          .from('users')
          .insert({ nickname: '新用户', phone })
          .select('id, openid, nickname, avatar_url, phone')
          .single();
        if (error) throw new Error(`创建用户失败: ${error.message}`);
        userId = newUser.id;
        user = newUser;
        await this.client.from('user_roles').insert({
          user_id: userId,
          role_type: 'parent',
          status: 'active',
        });
      }
    } else if (openid) {
      // 无手机号：按 openid 查
      const { data: byOpenid } = await this.client
        .from('users')
        .select('id, openid, nickname, avatar_url, phone')
        .eq('openid', openid)
        .maybeSingle();

      if (byOpenid) {
        userId = byOpenid.id;
        user = byOpenid;
      } else {
        const { data: newUser, error } = await this.client
          .from('users')
          .insert({ openid, nickname: '新用户' })
          .select('id, openid, nickname, avatar_url, phone')
          .single();
        if (error) throw new Error(`创建用户失败: ${error.message}`);
        userId = newUser.id;
        user = newUser;
        await this.client.from('user_roles').insert({
          user_id: userId,
          role_type: 'parent',
          status: 'active',
        });
      }
    } else {
      throw new Error('登录参数缺失');
    }

    const context = await this.getLoginContext(userId);
    return {
      user,
      token: this.generateToken(userId),
      ...context,
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
      custom_relationship?: string | null;
    }> = [];

    const parentRole = (roles || []).find(r => r.role_type === 'parent');
    if (parentRole) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id, relationship, custom_relationship')
        .eq('parent_role_id', parentRole.id)
        .eq('status', 'active');

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
   * 教师手机号登录：仅允许已开通 active 教师角色的用户登录
   */
  async teacherLoginByPhone(phone: string) {
    const supabase = getSupabaseClient();

    // 按手机号查找用户（不自动创建）
    const { data: user } = await supabase
      .from('users')
      .select('id, nickname, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      return { error: true, code: 403, msg: '该手机号未绑定教师账号' };
    }

    // 查找该用户名下 active 的教师角色
    const { data: role } = await supabase
      .from('user_roles')
      .select('id, real_name, role_type, status')
      .eq('role_type', 'teacher')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!role) {
      return { error: true, code: 403, msg: '该手机号下没有已激活的教师角色' };
    }

    // 查找教师档案
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id, real_name, nickname, title, class_id')
      .eq('status', 'active')
      .eq('real_name', role.real_name || user.nickname || '')
      .maybeSingle();

    if (teacherError || !teacher) {
      return { error: true, code: 403, msg: '未找到该教师' };
    }

    // 生成token
    const token = this.generateToken(user!.id);

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
        id: user.id,
        real_name: role.real_name || user.nickname || '',
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天有效

    // 落库，用于教师注册时校验
    const { data, error } = await this.client
      .from('teacher_invite_codes')
      .insert({
        code,
        inviter_admin_role_id: adminRoleId,
        expires_at: expiresAt,
        used: false,
      })
      .select('code, expires_at')
      .single();

    if (error) throw new Error(`生成邀请码失败: ${error.message}`);

    return {
      invite_code: data.code,
      expires_at: data.expires_at,
    };
  }

  /**
   * 使用邀请码注册教师
   */
  async registerTeacher(userId: string, inviteCode: string, realName: string) {
    // 校验邀请码：存在、未使用、未过期
    const { data: invite, error: inviteError } = await this.client
      .from('teacher_invite_codes')
      .select('id, code, expires_at, used')
      .eq('code', inviteCode)
      .maybeSingle();

    if (inviteError) throw new Error(`校验邀请码失败: ${inviteError.message}`);
    if (!invite) return { error: true, code: 400, msg: '邀请码无效' };
    if (invite.used) return { error: true, code: 400, msg: '邀请码已被使用' };
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return { error: true, code: 400, msg: '邀请码已过期' };
    }

    // 检查是否已有教师角色
    const { data: existingRole } = await this.client
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_type', 'teacher')
      .maybeSingle();

    if (existingRole) {
      return { error: true, code: 400, msg: '您已经是教师角色' };
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

    // 标记邀请码已使用
    await this.client
      .from('teacher_invite_codes')
      .update({ used: true })
      .eq('id', invite.id);

    // 更新用户昵称
    await this.client
      .from('users')
      .update({ nickname: realName })
      .eq('id', userId);

    return { role: newRole };
  }
}
