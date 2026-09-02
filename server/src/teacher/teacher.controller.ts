import { Controller, Get, Post, Put, Delete, Body, Query, Param, HttpCode, Headers, Req } from '@nestjs/common';
import { Request } from 'express';
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

  @Get('courses')
  @HttpCode(200)
  async getCourses(@Query('weekday') weekday?: string) {
    const data = await this.teacherService.getCourses(weekday);
    return { code: 200, msg: 'success', data };
  }

  @Get('class-students')
  @HttpCode(200)
  async getClassStudents(
    @Query('class_id') classId: string,
    @Query('course_id') courseId?: string,
  ) {
    const data = await this.teacherService.getClassStudents(classId, courseId);
    return { code: 200, msg: 'success', data };
  }

  @Get('feedbacks')
  @HttpCode(200)
  async getFeedbacks(
    @Query('teacher_role_id') teacherRoleId?: string,
    @Query('feedback_date') feedbackDate?: string,
  ) {
    const data = await this.teacherService.getFeedbacks(teacherRoleId, feedbackDate);
    return { code: 200, msg: 'success', data };
  }

  @Post('attendance')
  @HttpCode(200)
  async submitAttendance(@Req() req: Request, @Body() body: { records: Array<{ child_id: string; class_id: string; status: string }>; teacher_role_id?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.teacherService.submitAttendance(userId, body);
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const data: any = await this.teacherService.getById(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('feedback')
  @HttpCode(200)
  async submitFeedback(@Req() req: Request, @Body() body: {
    child_id: string;
    teacher_role_id?: string;
    group_id?: string;
    class_id?: string;
    course_id?: string;
    course_name?: string;
    meal_status: string | number;
    sleep_status: string | number;
    mood_status: string | number;
    activities?: string;
    notes?: string;
  }) {
    const userId = (req as any).user?.userId;
    const data = await this.teacherService.submitFeedback(userId, body);
    return { code: 200, msg: 'success', data };
  }

  @Put('feedback/:id')
  @HttpCode(200)
  async updateFeedback(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: {
      meal_status: string | number;
      sleep_status: string | number;
      mood_status: string | number;
      activities?: string;
      notes?: string;
    }) {
    const userId = (req as any).user?.userId;
    const data = await this.teacherService.updateFeedback(userId, { id, ...body });
    return { code: 200, msg: 'success', data };
  }

  @Delete('feedback/:id')
  @HttpCode(200)
  async deleteFeedback(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body?: { operator_role_id?: string },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.teacherService.deleteFeedback(userId, id, body?.operator_role_id);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
