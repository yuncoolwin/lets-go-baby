import { Controller, Get, Post, Body, Query, HttpCode } from '@nestjs/common';
import { TeacherService } from './teacher.service';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('class-overview')
  @HttpCode(200)
  async getClassOverview(@Query('teacher_role_id') teacherRoleId?: string) {
    const data = await this.teacherService.getClassOverview(teacherRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('class-students')
  @HttpCode(200)
  async getClassStudents(@Query('class_id') classId: string) {
    const data = await this.teacherService.getClassStudents(classId);
    return { code: 200, msg: 'success', data };
  }

  @Get('feedbacks')
  @HttpCode(200)
  async getFeedbacks(@Query('teacher_role_id') teacherRoleId?: string) {
    const data = await this.teacherService.getFeedbacks(teacherRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Post('attendance')
  @HttpCode(200)
  async submitAttendance(@Body() body: { records: Array<{ child_id: string; class_id: string; status: string }>; teacher_role_id?: string }) {
    const data = await this.teacherService.submitAttendance(body);
    return { code: 200, msg: 'success', data };
  }
}
