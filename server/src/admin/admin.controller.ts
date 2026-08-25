import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('children/:id/parents')
  @HttpCode(200)
  async getChildParents(@Param('id') id: string) {
    const data = await this.adminService.getChildParents(id);
    return { code: 200, msg: 'success', data };
  }

  @Delete('children/:childId/parents/:relationId')
  @HttpCode(200)
  async removeParentBinding(@Param('childId') childId: string, @Param('relationId') relationId: string) {
    const data = await this.adminService.removeParentBinding(childId, relationId);
    return { code: 200, msg: 'success', data };
  }

  @Get('pending-count')
  @HttpCode(200)
  async getPendingCount() {
    const data = await this.adminService.getPendingCount();
    return { code: 200, msg: 'success', data };
  }

  @Get('binding-requests')
  @HttpCode(200)
  async getBindingRequests() {
    const data = await this.adminService.getBindingRequests();
    return { code: 200, msg: 'success', data };
  }

  @Get('binding-requests/pending')
  @HttpCode(200)
  async getPendingBindingRequests() {
    const data = await this.adminService.getPendingBindingRequests();
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-requests/approve')
  @HttpCode(200)
  async approveBindingRequest(@Body() body: { request_id: string }) {
    const data = await this.adminService.approveBindingRequest(body.request_id);
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-requests/reject')
  @HttpCode(200)
  async rejectBindingRequest(@Body() body: { request_id: string; reason?: string }) {
    const data = await this.adminService.rejectBindingRequest(body.request_id, body.reason);
    return { code: 200, msg: 'success', data };
  }

  @Get('user/parent-status')
  @HttpCode(200)
  async getParentStatus(@Query('userId') userId: string) {
    const data = await this.adminService.getParentStatus(userId);
    return { code: 200, msg: 'success', data };
  }

  @Get('permission/users')
  @HttpCode(200)
  async getPermissionUsers(@Query('operator_user_id') operatorUserId: string) {
    return this.adminService.getPermissionUsers(operatorUserId);
  }

  @Post('permission/assign')
  @HttpCode(200)
  async assignRole(@Body() body: { operator_user_id: string; user_id: string; role_type: string }) {
    return this.adminService.assignRole(body.operator_user_id, body.user_id, body.role_type);
  }

  @Post('permission/revoke')
  @HttpCode(200)
  async revokeRole(@Body() body: { operator_user_id: string; user_role_id: string }) {
    return this.adminService.revokeRole(body.operator_user_id, body.user_role_id);
  }
}
