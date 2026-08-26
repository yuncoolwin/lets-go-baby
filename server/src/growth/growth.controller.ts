import { Controller, Get, Post, Put, Delete, Body, Query, Param, HttpCode } from '@nestjs/common';
import { GrowthService } from './growth.service';

@Controller('growth-records')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  @Post('upload')
  @HttpCode(200)
  async uploadImage(@Body() body: { image: string; name?: string }) {
    const data = await this.growthService.uploadImage(body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @HttpCode(200)
  async create(
    @Body()
    dto: { child_id: string; title: string; content?: string; photo_urls?: string[]; record_date?: string },
    @Query('role_id') roleId?: string,
  ) {
    const data = await this.growthService.create(dto, roleId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(
    @Query()
    query: { child_id?: string; child_ids?: string; record_date?: string; page?: string; page_size?: string; role_id?: string },
  ) {
    const data = await this.growthService.findAll(query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Param('id') id: string, @Query('role_id') roleId?: string) {
    const data = await this.growthService.findOne(id, roleId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() dto: { title?: string; content?: string; photo_urls?: string[]; record_date?: string },
    @Query('role_id') roleId?: string,
  ) {
    const data = await this.growthService.update(id, dto, roleId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string, @Query('role_id') roleId?: string) {
    const data = await this.growthService.remove(id, roleId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}