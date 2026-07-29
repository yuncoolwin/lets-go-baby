import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AuthService {
  private get client() {
    return getSupabaseClient();
  }

  async getUserInfo(userId?: string) {
    // If no userId, create a demo user for testing
    if (!userId) {
      const { data: existingUser } = await this.client
        .from('users')
        .select('id, nickname, avatar_url, phone')
        .eq('openid', 'demo_openid')
        .maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error } = await this.client
          .from('users')
          .insert({
            openid: 'demo_openid',
            nickname: '演示用户',
          })
          .select('id, nickname, avatar_url, phone')
          .single();

        if (error) throw new Error(`创建用户失败: ${error.message}`);
        userId = newUser.id;

        // Create demo roles
        await this.client.from('user_roles').insert([
          { user_id: userId, role_type: 'parent', real_name: '演示家长' },
          { user_id: userId, role_type: 'teacher', real_name: '演示老师' },
        ]);
      }
    }

    // Get user
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('id, nickname, avatar_url, phone')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw new Error(`查询用户失败: ${userError.message}`);
    if (!user) throw new Error('用户不存在');

    // Get roles
    const { data: roles, error: rolesError } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (rolesError) throw new Error(`查询角色失败: ${rolesError.message}`);

    return { user, roles: roles || [] };
  }

  async wxLogin(code: string) {
    // In production, exchange code for openid via WeChat API
    // For demo, just return demo user info
    return this.getUserInfo();
  }
}
