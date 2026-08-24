import { Controller, Get, Post, Body, Query, Param, Patch, Delete, HttpCode } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateNotificationDto, @Query('author_id') authorId?: string) {
    const data = await this.notificationsService.create(dto, authorId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(
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
    const data = await this.notificationsService.findAll(query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('stats')
  @HttpCode(200)
  async getStats(@Query('author_id') authorId?: string) {
    const data = await this.notificationsService.getStats(authorId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Param('id') id: string) {
    const data = await this.notificationsService.findOne(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateNotificationDto>) {
    const data = await this.notificationsService.update(id, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    const data = await this.notificationsService.remove(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@Param('id') id: string, @Body() body: { user_role_id?: string; user_id?: string }) {
    const data = await this.notificationsService.markRead(id, body.user_role_id || body.user_id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Param('id') id: string) {
    const data = await this.notificationsService.revoke(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}