import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  findAll() {
    return this.holidaysService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; type: string; target_id?: string; start_date: string; end_date: string }) {
    return this.holidaysService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.holidaysService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }

  @Get('child/:childId')
  findByChild(@Param('childId') childId: string) {
    return this.holidaysService.findByChild(childId);
  }
}