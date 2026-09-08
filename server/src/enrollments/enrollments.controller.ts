import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { EnrollmentsService, CreateEnrollmentDto, UpdateEnrollmentDto } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('child/:childId')
  async findByChild(@Req() req: Request, @Param('childId') childId: string) {
    const userId = (req as any).user?.userId;
    try {
      const data = await this.enrollmentsService.findByChild(userId, childId);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      const code = e instanceof ForbiddenException ? 403 : 500;
      return { code, msg: e.message || '查询失败', data: null };
    }
  }

  @Get('by-course')
  async findByCourse(@Query('course_id') courseId: string, @Query('date') date?: string) {
    try {
      const data = await this.enrollmentsService.findByCourse(courseId || '', date || '');
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '查询失败', data: null };
    }
  }

  @Get('child/:childId/active')
  async findActiveByChild(@Req() req: Request, @Param('childId') childId: string) {
    const userId = (req as any).user?.userId;
    try {
      const data = await this.enrollmentsService.findActiveByChild(userId, childId);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      const code = e instanceof ForbiddenException ? 403 : 500;
      return { code, msg: e.message || '查询失败', data: null };
    }
  }

  @Post()
  @HttpCode(200)
  async create(@Req() req: Request, @Body() body: CreateEnrollmentDto) {
    const userId = (req as any).user?.userId;
    try {
      const data = await this.enrollmentsService.create(userId, body);
      return { code: 200, msg: '创建成功', data };
    } catch (e: any) {
      const code = e instanceof ForbiddenException ? 403 : 500;
      return { code, msg: e.message || '创建失败', data: null };
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateEnrollmentDto) {
    const userId = (req as any).user?.userId;
    try {
      const data = await this.enrollmentsService.update(userId, id, body);
      return { code: 200, msg: '更新成功', data };
    } catch (e: any) {
      const code = e instanceof ForbiddenException ? 403 : 500;
      return { code, msg: e.message || '更新失败', data: null };
    }
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    try {
      const result = await this.enrollmentsService.remove(userId, id);
      if ((result as any)?.error) {
        return { code: (result as any).code, msg: (result as any).msg, data: null };
      }
      return { code: 200, msg: '删除成功' };
    } catch (e: any) {
      return { code: 500, msg: e.message || '删除失败', data: null };
    }
  }

  @Get(':id/attendance-calendar')
  @HttpCode(200)
  async getAttendanceCalendar(@Param('id') id: string) {
    try {
      const data = await this.enrollmentsService.getAttendanceCalendar(id);
      return { code: 200, msg: 'success', data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '查询失败', data: null };
    }
  }

  @Get(':id/calc-extended-end-date')
  @HttpCode(200)
  async calcExtendedEndDate(@Param('id') id: string) {
    try {
      const data = await this.enrollmentsService.calcExtendedEndDateAndPersist(id);
      return { code: 200, msg: 'success', data: data };
    } catch (e: any) {
      return { code: 500, msg: e.message || '计算失败', data: null };
    }
  }
}
