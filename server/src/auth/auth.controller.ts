import { Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('user-info')
  @HttpCode(200)
  async getUserInfo(@Query('user_id') userId?: string) {
    const data = await this.authService.getUserInfo(userId);
    return { code: 200, msg: 'success', data };
  }

  @Post('wx-login')
  @HttpCode(200)
  async wxLogin(@Query('code') code: string) {
    const data = await this.authService.wxLogin(code);
    return { code: 200, msg: 'success', data };
  }
}
