import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(200)
  async getNotifications(
    @Query('target_type') targetType?: string,
    @Query('target_id') targetId?: string,
  ) {
    const data = await this.notificationService.getNotifications(targetType, targetId);
    return { code: 200, msg: 'success', data };
  }
}
