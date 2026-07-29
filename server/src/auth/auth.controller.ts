import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 微信登录（Mock模式）
   * GET /api/auth/wx-login?code=xxx&mock_role=parent|teacher|admin
   */
  @Get('wx-login')
  @HttpCode(200)
  async wxLogin(
    @Query('code') code: string,
    @Query('mock_role') mockRole?: string,
  ) {
    const data = await this.authService.wxLogin(code || 'demo', mockRole);
    return { code: 200, msg: 'success', data };
  }

  /**
   * 获取用户信息
   * GET /api/auth/user-info?user_id=xxx
   */
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
  @Post('select-role')
  @HttpCode(200)
  async selectRole(@Body() body: { user_id: string; role_type: string }) {
    const data = await this.authService.selectRole(body.user_id, body.role_type);
    return { code: 200, msg: 'success', data };
  }

  /**
   * 生成教师邀请码
   * POST /api/auth/generate-invite-code
   */
  @Post('generate-invite-code')
  @HttpCode(200)
  async generateInviteCode(@Body() body: { admin_role_id: string }) {
    const data = await this.authService.generateInviteCode(body.admin_role_id);
    return { code: 200, msg: 'success', data };
  }

  /**
   * 使用邀请码注册教师
   * POST /api/auth/register-teacher
   */
  @Post('register-teacher')
  @HttpCode(200)
  async registerTeacher(@Body() body: { user_id: string; invite_code: string; real_name: string }) {
    const data = await this.authService.registerTeacher(body.user_id, body.invite_code, body.real_name);
    return { code: 200, msg: 'success', data };
  }
}
