import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  findAll() {
    return this.holidaysService.findAll();
  }

  @Post()
  create(@Req() req: Request, @Body() body: { name: string; type: string; target_id?: string; start_date: string; end_date: string }) {
    const userId = (req as any).user?.userId;
    return this.holidaysService.create(userId, body);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const userId = (req as any).user?.userId;
    return this.holidaysService.update(userId, id, body);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const result = await this.holidaysService.remove(userId, id);
    if ((result as any)?.error) {
      return { code: (result as any).code, msg: (result as any).msg, data: null };
    }
    return result;
  }

  @Get('child/:childId')
  findByChild(@Param('childId') childId: string) {
    return this.holidaysService.findByChild(childId);
  }
}