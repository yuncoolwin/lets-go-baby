import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
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
  async create(@Body() body: any) {
    const data = await this.coursesService.create(body);
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const result = await this.coursesService.update(id, body);
    if (result && result.success === false) {
      return { code: 400, msg: result.message };
    }
    return { code: 200, msg: 'success', data: result };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Body() body: { operator_user_id?: string; operator_role_id?: string }) {
    const result = await this.coursesService.remove(id, body.operator_user_id, body.operator_role_id);
    if (result.success === false) {
      return { code: 400, msg: result.message };
    }
    return { code: 200, msg: 'success' };
  }
}