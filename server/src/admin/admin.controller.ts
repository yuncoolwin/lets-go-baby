import { Controller, Get, Post, Body, Query, HttpCode } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
