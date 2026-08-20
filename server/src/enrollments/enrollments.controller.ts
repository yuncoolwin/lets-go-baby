import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { EnrollmentsService, CreateEnrollmentDto, UpdateEnrollmentDto } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('child/:childId')
  async findByChild(@Param('childId') childId: string) {
    try {
      const data = await this.enrollmentsService.findByChild(childId);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '查询失败' };
    }
  }

  @Get('child/:childId/active')
  async findActiveByChild(@Param('childId') childId: string) {
    try {
      const data = await this.enrollmentsService.findActiveByChild(childId);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '查询失败' };
    }
  }

  @Post()
  @HttpCode(200)
  async create(@Body() body: CreateEnrollmentDto) {
    try {
      const data = await this.enrollmentsService.create(body);
      return { code: 200, msg: '创建成功', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '创建失败' };
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() body: UpdateEnrollmentDto) {
    try {
      const data = await this.enrollmentsService.update(id, body);
      return { code: 200, msg: '更新成功', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '更新失败' };
    }
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    try {
      await this.enrollmentsService.remove(id);
      return { code: 200, msg: '删除成功' };
    } catch (e: any) {
      return { code: 500, msg: e.message || '删除失败' };
    }
  }

  @Get(':id/attendance-calendar')
  @HttpCode(200)
  async getAttendanceCalendar(@Param('id') id: string) {
    try {
      const data = await this.enrollmentsService.getAttendanceCalendar(id);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '查询失败' };
    }
  }

  @Get(':id/calc-extended-end-date')
  @HttpCode(200)
  async calcExtendedEndDate(@Param('id') id: string) {
    try {
      const data = await this.enrollmentsService.calcExtendedEndDateAndPersist(id);
      return { code: 200, msg: 'success', data: data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '计算失败' };
    }
  }
}