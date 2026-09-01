import { Controller, Get, Post, Patch, Body, Query, Param, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParentService } from './parent.service';

@Controller('parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('baby-status')
  @HttpCode(200)
  async getBabyStatus(@Req() req: Request, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.getBabyStatus(userId, agentChildId);
    return { code: 200, msg: 'success', data };
  }

  @Get('feedbacks')
  @HttpCode(200)
  async getFeedbacks(@Req() req: Request, @Query('feedback_date') feedbackDate?: string, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.getFeedbacks(userId, feedbackDate, agentChildId);
    return { code: 200, msg: 'success', data };
  }

  @Get('attendance')
  @HttpCode(200)
  async getAttendance(@Req() req: Request, @Query('course_type') courseType?: string, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.getAttendance(userId, courseType, agentChildId);
    return { code: 200, msg: 'success', data };
  }

  @Get('growth-records')
  @HttpCode(200)
  async getGrowthRecords(@Req() req: Request, @Query('child_id') childId?: string) {
    const userId = (req as any).user?.userId;
    const data: any = await this.parentService.getGrowthRecords(userId, childId, childId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('growth-records/read')
  @HttpCode(200)
  async markGrowthRead(@Req() req: Request, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.markGrowthRead(userId, agentChildId);
    return { code: 200, msg: 'success', data };
  }

  @Get('growth-records/unread-count')
  @HttpCode(200)
  async getGrowthUnreadCount(@Req() req: Request, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.getGrowthUnreadCount(userId, agentChildId);
    return { code: 200, msg: 'success', data };
  }

  @Get('search-children')
  @HttpCode(200)
  async searchChildren(@Req() req: Request, @Query('keyword') keyword: string) {
    const userId = (req as any).user?.userId;
    const data = await this.parentService.searchChildren(userId, keyword);
    return { code: 200, msg: 'success', data };
  }

  @Get('child/:id')
  @HttpCode(200)
  async getChildById(@Req() req: Request, @Param('id') id: string, @Query('child_id') agentChildId?: string) {
    const userId = (req as any).user?.userId;
    const data: any = await this.parentService.getChildById(userId, id, agentChildId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch('child/:id')
  @HttpCode(200)
  async updateChild(@Req() req: Request, @Param('id') id: string, @Body() body: {
    name?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
    relationship?: string;
    custom_relationship?: string;
  }) {
    const userId = (req as any).user?.userId;
    const data: any = await this.parentService.updateChild(userId, id, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('daily-feedbacks')
  @HttpCode(200)
  async getDailyFeedbacks(
    @Req() req: Request,
    @Query('child_id') childId: string,
    @Query('feedback_date') feedbackDate: string,
  ) {
    const userId = (req as any).user?.userId;
    const data: any = await this.parentService.getDailyFeedbacks(userId, childId, feedbackDate, childId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-request')
  @HttpCode(200)
  async submitBindingRequest(@Req() req: Request, @Body() body: {
    child_id?: string;
    relationship?: string;
    custom_relationship?: string;
  }) {
    const userId = (req as any).user?.userId;
    const data: any = await this.parentService.submitBindingRequest(userId, body);
    // 防重复检查返回的错误信息
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
