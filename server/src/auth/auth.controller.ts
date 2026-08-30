import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 微信登录（Mock模式）
   * GET /api/auth/wx-login?code=xxx
   */
  @Public()
  @Get('wx-login')
  @HttpCode(200)
  async wxLogin(
    @Query('code') code: string,
  ) {
    const data = await this.authService.wxLogin(code || 'demo');
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  /**
   * 获取用户信息
   * GET /api/auth/user-info?user_id=xxx
   */
  @Public()
  @Get('user-info')
  @HttpCode(200)
  async getUserInfo(@Query('user_id') userId: string) {
    if (!userId) {
      return { code: 400, msg: 'user_id is required', data: null };
    }
    const data = await this.authService.getUserInfo(userId);
    return { code: 200, msg: 'success', data };
  }

  /**
   * 选择角色（多角色用户）
   * POST /api/auth/select-role
   */
  @Public()
  @Post('select-role')
  @HttpCode(200)
  async selectRole(@Body() body?: { user_id: string; role_type: string }) {
    if (!body?.user_id || !body?.role_type) {
      return { code: 400, msg: 'user_id 与 role_type 为必填', data: null };
    }
    try {
      const data = await this.authService.selectRole(body.user_id, body.role_type);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 400, msg: e?.message || '选择角色失败', data: null };
    }
  }

  /**
   * 生成教师邀请码
   * POST /api/auth/generate-invite-code
   */
  @Public()
  @Post('generate-invite-code')
  @HttpCode(200)
  async generateInviteCode(@Body() body: { admin_role_id: string }) {
    const data = await this.authService.generateInviteCode(body.admin_role_id);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  /**
   * 使用邀请码注册教师
   * POST /api/auth/register-teacher
   */
  @Public()
  @Post('register-teacher')
  @HttpCode(200)
  async registerTeacher(@Body() body: { user_id: string; invite_code: string; real_name: string }) {
    const data = await this.authService.registerTeacher(body.user_id, body.invite_code, body.real_name);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  /**
   * 教师登录（手机号）
   * POST /api/auth/teacher-login
   */
  @Public()
  @Post('teacher-login')
  @HttpCode(200)
  async teacherLogin(@Body() body: { phone: string }) {
    const data = await this.authService.teacherLoginByPhone(body.phone);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  /**
   * 手机号一键登录
   * POST /api/auth/phone-login
   */
  @Public()
  @Post('phone-login')
  @HttpCode(200)
  async phoneLogin(
    @Body() body: { login_code: string; phone_code?: string },
  ) {
    const data = await this.authService.phoneLogin(
      body.login_code,
      body.phone_code,
    );
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
