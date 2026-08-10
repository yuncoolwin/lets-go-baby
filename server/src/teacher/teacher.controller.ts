import { Controller, Get, Post, Put, Delete, Body, Query, Param, HttpCode, Headers } from '@nestjs/common';
import { TeacherService } from './teacher.service';

@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('me')
  @HttpCode(200)
  async getMe(@Query('teacher_role_id') teacherRoleId?: string) {
    const data = await this.teacherService.getMe(teacherRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('classes')
  @HttpCode(200)
  async getTeacherClasses(@Query('teacher_role_id') teacherRoleId: string) {
    const data = await this.teacherService.getTeacherClasses(teacherRoleId);
    return { code: 200, msg: 'success', data };
  }

  @Get('class-overview')
  @HttpCode(200)
  async getClassOverview(
    @Query('teacher_role_id') teacherRoleId?: string,
    @Query('teacher_id') teacherId?: string,
  ) {
    const id = teacherRoleId || teacherId;
    const data = await this.teacherService.getClassOverview(id);
    return { code: 200, msg: 'success', data };
  }

  @Get('grouped-overview')
  @HttpCode(200)
  async getGroupedOverview(
    @Query('teacher_role_id') teacherRoleId?: string,
    @Query('teacher_id') teacherId?: string,
    @Query('date') date?: string,
    @Query('class_id') classId?: string,
  ) {
    // 管理员模式：直接按 class_id 查询
    if (classId) {
      const data = await this.teacherService.getGroupedOverviewByClass(classId, date);
      return { code: 200, msg: 'success', data };
    }
    const id = teacherRoleId || teacherId;
    const data = await this.teacherService.getGroupedOverview(id, date);
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

  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.teacherService.getById(id);
    return { code: 200, msg: 'success', data };
  }

  @Post('feedback')
  @HttpCode(200)
  async submitFeedback(@Body() body: {
    child_id: string;
    teacher_role_id?: string;
    meal_status: string;
    sleep_status: string;
    mood_status: string;
    activities?: string;
    notes?: string;
  }) {
    const data = await this.teacherService.submitFeedback(body);
    return { code: 200, msg: 'success', data };
  }

  @Put('feedback/:id')
  @HttpCode(200)
  async updateFeedback(
    @Param('id') id: string,
    @Body() body: {
      meal_status: string;
      sleep_status: string;
      mood_status: string;
      activities?: string;
      notes?: string;
    }) {
    const data = await this.teacherService.updateFeedback({ id, ...body });
    return { code: 200, msg: 'success', data };
  }

  @Delete('feedback/:id')
  @HttpCode(200)
  async deleteFeedback(@Param('id') id: string) {
    const data = await this.teacherService.deleteFeedback(id);
    return { code: 200, msg: 'success', data };
  }
}
