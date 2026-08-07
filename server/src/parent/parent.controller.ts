import { Controller, Get, Post, Patch, Body, Query, Param, HttpCode } from '@nestjs/common';
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

  @Get('search-children')
  @HttpCode(200)
  async searchChildren(@Query('keyword') keyword: string) {
    const data = await this.parentService.searchChildren(keyword);
    return { code: 200, msg: 'success', data };
  }

  @Get('child/:id')
  @HttpCode(200)
  async getChildById(@Param('id') id: string) {
    const data = await this.parentService.getChildById(id);
    return { code: 200, msg: 'success', data };
  }

  @Patch('child/:id')
  @HttpCode(200)
  async updateChild(@Param('id') id: string, @Body() body: {
    name?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
    relationship?: string;
    custom_relationship?: string;
  }) {
    const data = await this.parentService.updateChild(id, body);
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-request')
  @HttpCode(200)
  async submitBindingRequest(@Body() body: { user_id?: string; parent_role_id: string; child_name: string; child_id?: string; relationship: string; custom_relationship?: string; nickname?: string; gender?: string; birth_date?: string; allergies?: string }) {
    const data = await this.parentService.submitBindingRequest(body);
    // 防重复检查返回的错误信息
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
