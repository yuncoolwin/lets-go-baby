import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll() {
    const result = await this.coursesService.findAll();
    return { code: 200, msg: 'success', data: result };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.coursesService.create(body);
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.coursesService.update(id, body);
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.coursesService.remove(id);
    return { code: 200, msg: 'success' };
  }
}