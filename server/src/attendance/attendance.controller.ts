import { Controller, Get, Post, Body, Query, HttpCode, Param } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('admin/overview')
  @HttpCode(200)
  async getAdminOverview(
    @Query('class_id') classId: string,
    @Query('date') date?: string,
  ) {
    const data = await this.attendanceService.getAdminOverview(classId, date);
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
      course_type?: string;
      operator_user_id?: string;
      operator_role_id?: string;
    },
  ) {
    const data = await this.attendanceService.upsert(body);
    return { code: 200, msg: 'success', data };
  }

  @Post('check-out')
  @HttpCode(200)
  async checkOut(
    @Body() body: { childId: string; classId: string; date: string; courseType?: string },
  ) {
    const data = await this.attendanceService.checkOut({
      childId: body.childId,
      classId: body.classId,
      date: body.date,
      courseType: body.courseType,
    });
    return { code: 200, msg: 'success', data };
  }

  @Post('clear')
  @HttpCode(200)
  async clearByClassAndDate(
    @Body() body: { class_id: string; date: string; operator_user_id?: string; operator_role_id?: string },
  ) {
    const data = await this.attendanceService.clearByClassAndDate(body.class_id, body.date, undefined, body.operator_user_id, body.operator_role_id);
    return { code: 200, msg: 'success', data };
  }

  @Get('dates/:classId')
  @HttpCode(200)
  async getDates(@Param('classId') classId: string) {
    const data = await this.attendanceService.getDates(classId);
    return { code: 200, msg: 'success', data };
  }
}
