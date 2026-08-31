import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('children/:id/parents')
  @HttpCode(200)
  async getChildParents(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.getChildParents(userId, id);
    if ((data as any)?.code) return data as any;
    return { code: 200, msg: 'success', data };
  }

  @Delete('children/:childId/parents/:relationId')
  @HttpCode(200)
  async removeParentBinding(
    @Req() req: Request,
    @Param('childId') childId: string,
    @Param('relationId') relationId: string,
  ) {
    const userId = (req as any).user?.userId;
    return (await this.adminService.removeParentBinding(userId, childId, relationId)) as any;
  }

  @Get('pending-count')
  @HttpCode(200)
  async getPendingCount(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.getPendingCount(userId);
    if ((data as any)?.code) return data as any;
    return { code: 200, msg: 'success', data };
  }

  @Get('binding-requests')
  @HttpCode(200)
  async getBindingRequests(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.getBindingRequests(userId);
    if ((data as any)?.code) return data as any;
    return { code: 200, msg: 'success', data };
  }

  @Get('binding-requests/pending')
  @HttpCode(200)
  async getPendingBindingRequests(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.getPendingBindingRequests(userId);
    if ((data as any)?.code) return data as any;
    return { code: 200, msg: 'success', data };
  }

  @Post('binding-requests/approve')
  @HttpCode(200)
  async approveBindingRequest(@Req() req: Request, @Body() body: { request_id: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.approveBindingRequest(body.request_id, userId);
  }

  @Post('binding-requests/reject')
  @HttpCode(200)
  async rejectBindingRequest(@Req() req: Request, @Body() body: { request_id: string; reason?: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.rejectBindingRequest(body.request_id, body.reason, userId);
  }

  @Post('binding-requests/delete')
  @HttpCode(200)
  async deleteBindingRequest(@Req() req: Request, @Body() body: { request_id: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.deleteBindingRequest(userId, body.request_id);
    if ((data as any)?.error || (data as any)?.code !== 200) {
      return { code: (data as any)?.code || 500, msg: (data as any)?.msg || '删除失败', data: null };
    }
    return { code: 200, msg: 'success', data: (data as any)?.data };
  }

  @Post('binding-requests/update')
  @HttpCode(200)
  async updateBindingRequest(
    @Req() req: Request,
    @Body() body: { request_id: string; relationship?: string; custom_relationship?: string },
  ) {
    const userId = (req as any).user?.userId;
    return this.adminService.updateBindingRequest(userId, body.request_id, body.relationship, body.custom_relationship);
  }

  @Post('binding-requests/set-status')
  @HttpCode(200)
  async setBindingRequestStatus(@Req() req: Request, @Body() body: { request_id: string; status: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.setBindingRequestStatus(body.request_id, body.status, userId);
  }

  @Get('user/parent-status')
  @HttpCode(200)
  async getParentStatus(@Req() req: Request, @Query('userId') targetUserId: string) {
    const userId = (req as any).user?.userId;
    const data = await this.adminService.getParentStatus(userId, targetUserId);
    return { code: 200, msg: 'success', data };
  }

  @Get('permission/users')
  @HttpCode(200)
  async getPermissionUsers(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.adminService.getPermissionUsers(userId);
  }

  @Post('permission/assign')
  @HttpCode(200)
  async assignRole(@Req() req: Request, @Body() body: { user_id: string; role_type: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.assignRole(userId, body.user_id, body.role_type);
  }

  @Post('permission/revoke')
  @HttpCode(200)
  async revokeRole(@Req() req: Request, @Body() body: { user_role_id: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.revokeRole(userId, body.user_role_id);
  }

  @Post('permission/user')
  @HttpCode(200)
  async createPermissionUser(@Req() req: Request, @Body() body: { nickname: string; phone: string }) {
    const userId = (req as any).user?.userId;
    return this.adminService.createPermissionUser(userId, body.nickname, body.phone);
  }

  @Put('permission/user/:id')
  @HttpCode(200)
  async updatePermissionUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { nickname: string; phone: string },
  ) {
    const userId = (req as any).user?.userId;
    return this.adminService.updatePermissionUser(userId, id, body.nickname, body.phone);
  }

  @Delete('permission/user/:id')
  @HttpCode(200)
  async deletePermissionUser(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    return this.adminService.deletePermissionUser(userId, id);
  }

  @Get('audit-logs')
  @HttpCode(200)
  async getAuditLogs(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('action') action?: string,
    @Query('target_type') targetType?: string,
    @Query('date') date?: string,
  ) {
    const userId = (req as any).user?.userId;
    return this.adminService.getAuditLogs(
      userId,
      page ? parseInt(page, 10) || 1 : 1,
      pageSize ? parseInt(pageSize, 10) || 20 : 20,
      action,
      targetType,
      date,
    );
  }

  @Get('audit-logs/dates')
  @HttpCode(200)
  async getAuditLogDates(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.adminService.getAuditLogDates(userId);
  }
}
