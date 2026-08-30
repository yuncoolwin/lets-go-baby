import { Controller, Get, Post, Body, Query, Param, Patch, Delete, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import type { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(200)
  async create(@Req() req: Request, @Body() dto: CreateNotificationDto) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.create(userId, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('upload')
  @HttpCode(200)
  async uploadImage(@Req() req: Request, @Body() body: { image: string; name?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.uploadImage(userId, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(
    @Req() req: Request,
    @Query()
    query: {
      page?: number | string;
      page_size?: number | string;
      type?: string;
      keyword?: string;
      scope?: string;
      user_role_id?: string;
      author_id?: string;
    },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.findAll(userId, query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('stats')
  @HttpCode(200)
  async getStats(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.getStats(userId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('unread-count')
  @HttpCode(200)
  async unreadCount(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.getUnreadCount(userId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.findOne(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: Partial<CreateNotificationDto> & { operator_role_id?: string }) {
    const userId = (req as any).user?.userId;
    const { operator_role_id: _ignored, ...rest } = dto;
    const data = await this.notificationsService.update(userId, id, rest);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') id: string, @Body() body?: { operator_role_id?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.remove(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.markRead(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.notificationsService.revoke(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
