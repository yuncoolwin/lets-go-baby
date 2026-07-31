import { Controller, Get, Post, Body, Query, HttpCode } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @HttpCode(200)
  async findByClass(
    @Query('class_id') classId: string,
    @Query('date') date?: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.attendanceService.findByClassAndDate(classId, date || today);
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @HttpCode(200)
  async upsert(
    @Body()
    body: {
      child_id: string;
      teacher_id: string;
      class_id: string;
      date: string;
      status: string;
    },
  ) {
    const data = await this.attendanceService.upsert(body);
    return { code: 200, msg: 'success', data };
  }
}
