import { Controller, Get, Post, Put, Delete, Body, Query, Param, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GrowthService } from './growth.service';

@Controller('growth-records')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  @Post('upload')
  @HttpCode(200)
  async uploadImage(@Req() req: Request, @Body() body: { image: string; name?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.uploadImage(userId, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body()
    dto: { child_id: string; title: string; content?: string; photo_urls?: string[]; record_date?: string; course_name?: string },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.create(userId, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(
    @Req() req: Request,
    @Query() query: { child_id?: string; child_ids?: string; record_date?: string; page?: string; page_size?: string; role_id?: string },
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.findAll(userId, query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  @HttpCode(200)
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.findOne(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  @HttpCode(200)
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: { title?: string; content?: string; photo_urls?: string[]; record_date?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.update(userId, id, dto);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.remove(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
