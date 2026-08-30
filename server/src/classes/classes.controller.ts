import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClassesService } from './classes.service';
import type { CreateClassDto, UpdateClassDto, ClassQueryDto } from './dto/create-class.dto';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @HttpCode(200)
  async create(@Req() req: Request, @Body() dto: CreateClassDto) {
    const userId = (req as any).user?.userId;
    const data = await this.classesService.create(userId, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    const query: ClassQueryDto = {
      page: page ? parseInt(page, 10) : undefined,
      page_size: pageSize ? parseInt(pageSize, 10) : undefined,
      level,
      status,
      keyword,
    };
    const data = await this.classesService.findAll(query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id/enrollments')
  @HttpCode(200)
  async getEnrollments(
    @Param('id') id: string,
    @Query('course_type') courseType?: string,
  ) {
    const data = await this.classesService.getEnrollmentsByClass(id, courseType);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('stats')
  @HttpCode(200)
  async getStats() {
    const data = await this.classesService.getStats();
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Param('id') id: string) {
    const data = await this.classesService.findOne(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateClassDto) {
    const userId = (req as any).user?.userId;
    const data = await this.classesService.update(userId, id, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.classesService.remove(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/teachers')
  @HttpCode(200)
  async assignTeacher(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { teacher_id: string; is_lead?: boolean },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.classesService.assignTeacher(userId, id, body.teacher_id, body.is_lead || false);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id/teachers/:tid')
  @HttpCode(200)
  async removeTeacher(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('tid') tid: string,
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.classesService.removeTeacher(userId, id, tid);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
