import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto, UpdateTeacherDto, TeacherQueryDto } from './dto/create-teacher.dto';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @HttpCode(200)
  async create(@Req() req: Request, @Body() body: CreateTeacherDto) {
    const userId = (req as any).user?.userId;
    const data = await this.teachersService.create(userId, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(@Req() req: Request, @Query() query: TeacherQueryDto) {
    const userId = (req as any).user?.userId;
    const data = await this.teachersService.findAll(userId, query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('stats')
  @HttpCode(200)
  async getStats() {
    const data = await this.teachersService.getStats();
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.teachersService.findOne(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateTeacherDto) {
    const userId = (req as any).user?.userId;
    const data = await this.teachersService.update(userId, id, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.teachersService.remove(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
