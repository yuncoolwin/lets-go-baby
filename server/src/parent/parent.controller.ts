import { Controller, Get, Post, Body, Query, HttpCode } from '@nestjs/common';
import { ParentService } from './parent.service';

@Controller('parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('baby-status')
  @HttpCode(200)
  async getBabyStatus(@Query('parent_role_id') parentRoleId?: string) {
    const data = await this.parentService.getBabyStatus(parentRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('feedbacks')
  @HttpCode(200)
  async getFeedbacks(@Query('parent_role_id') parentRoleId?: string) {
    const data = await this.parentService.getFeedbacks(parentRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('attendance')
  @HttpCode(200)
  async getAttendance(@Query('parent_role_id') parentRoleId?: string) {
    const data = await this.parentService.getAttendance(parentRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('growth-records')
  @HttpCode(200)
  async getGrowthRecords(@Query('parent_role_id') parentRoleId?: string) {
    const data = await this.parentService.getGrowthRecords(parentRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-request')
  @HttpCode(200)
  async submitBindingRequest(@Body() body: { parent_role_id: string; child_name: string; relationship: string }) {
    const data = await this.parentService.submitBindingRequest(body);
    return { code: 200, msg: 'success', data };
  }
}
