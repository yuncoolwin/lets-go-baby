import { Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  async getAll(@Query('year') year?: string) {
    const data = await this.holidaysService.getAll(year ? parseInt(year) : undefined);
    return { code: 200, msg: 'success', data };
  }

  @Post('update')
  @HttpCode(200)
  async update() {
    const result = await this.holidaysService.updateFromPreset();
    return { code: 200, msg: '节假日数据更新成功', data: result };
  }
}