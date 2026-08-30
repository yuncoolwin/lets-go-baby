import { Controller, Get, Post, Body, Query, HttpCode, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('admin/overview')
  @HttpCode(200)
  async getAdminOverview(
    @Req() req: Request,
    @Query('class_id') classId: string,
    @Query('date') date?: string,
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.attendanceService.getAdminOverview(userId, classId, date);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('holiday-status')
  @HttpCode(200)
  async getHolidayStatus(
    @Query('class_id') classId: string,
    @Query('date') date?: string,
  ) {
    const data = await this.attendanceService.getHolidayStatus(classId, date);
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findByClass(
    @Req() req: Request,
    @Query('class_id') classId: string,
    @Query('date') date?: string,
  ) {
    const userId = (req as any).user?.userId;
    const today = new Date().toISOString().split('T')[0];
    const data = await this.attendanceService.findByClassAndDate(userId, classId, date || today);
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @HttpCode(200)
  async upsert(
    @Req() req: Request,
    @Body()
    body: {
      child_id: string;
      teacher_id: string;
      class_id: string;
      date: string;
      status: string;
      course_type?: string;
    },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.attendanceService.upsert(userId, body);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('check-out')
  @HttpCode(200)
  async checkOut(
    @Req() req: Request,
    @Body() body: { childId: string; classId: string; date: string; courseType?: string },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.attendanceService.checkOut(userId, {
      childId: body.childId,
      classId: body.classId,
      date: body.date,
      courseType: body.courseType,
    });
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('clear')
  @HttpCode(200)
  async clearByClassAndDate(
    @Req() req: Request,
    @Body() body: { class_id: string; date: string },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.attendanceService.clearByClassAndDate(userId, body.class_id, body.date);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('dates/:classId')
  @HttpCode(200)
  async getDates(@Param('classId') classId: string) {
    const data = await this.attendanceService.getDates(classId);
    return { code: 200, msg: 'success', data };
  }
}
