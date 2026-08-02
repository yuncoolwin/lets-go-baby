import { Controller, Get, Post, Body, Query, HttpCode, Param } from '@nestjs/common';
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

  @Post('clear')
  @HttpCode(200)
  async clearByClassAndDate(
    @Body() body: { class_id: string; date: string },
  ) {
    const data = await this.attendanceService.clearByClassAndDate(body.class_id, body.date);
    return { code: 200, msg: 'success', data };
  }

  @Get('dates/:classId')
  @HttpCode(200)
  async getDates(@Param('classId') classId: string) {
    const data = await this.attendanceService.getDates(classId);
    return { code: 200, msg: 'success', data };
  }
}
