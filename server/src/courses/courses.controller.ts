import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll(@Query('weekday') weekday?: string) {
    const result = await this.coursesService.findAll(weekday);
    return { code: 200, msg: 'success', data: result };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.userId;
    try {
      const data = await this.coursesService.create(userId, body);
      return { code: 200, msg: 'success', data };
    } catch (err: any) {
      const code = err instanceof ForbiddenException ? 403 : 500;
      return { code, msg: err?.message || '创建失败', data: null };
    }
  }

  @Put(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const userId = (req as any).user?.userId;
    try {
      const result = await this.coursesService.update(userId, id, body);
      if (result && result.success === false) {
        return { code: 400, msg: result.message };
      }
      return { code: 200, msg: 'success', data: result };
    } catch (err: any) {
      const code = err instanceof ForbiddenException ? 403 : 500;
      return { code, msg: err?.message || '更新失败', data: null };
    }
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const result = await this.coursesService.remove(userId, id);
    if (result.success === false) {
      return { code: (result as any).code || 400, msg: result.message };
    }
    return { code: 200, msg: 'success' };
  }
}
