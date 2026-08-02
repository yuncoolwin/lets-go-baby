import { Controller, Get, Post, Delete, Query, Param, HttpCode } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  async getAll(@Query('year') year?: string) {
    const data = await this.holidaysService.getAll(year ? parseInt(year) : undefined);
    return { code: 200, msg: 'success', data };
  }

  @Get('years')
  async getYears() {
    const data = await this.holidaysService.getAvailableYears();
    return { code: 200, msg: 'success', data };
  }

  @Post('update')
  @HttpCode(200)
  async updateAll() {
    const result = await this.holidaysService.updateAll();
    return { code: 200, msg: '节假日数据更新成功', data: result };
  }

  @Post('update/:year')
  @HttpCode(200)
  async updateByYear(@Param('year') year: string) {
    try {
      const result = await this.holidaysService.updateByYear(parseInt(year));
      return { code: 200, msg: `${year}年节假日数据更新成功`, data: result };
    } catch (e: any) {
      return { code: 404, msg: e.message || `${year}年暂无节假日数据` };
    }
  }

  @Delete(':year')
  @HttpCode(200)
  async deleteByYear(@Param('year') year: string) {
    const result = await this.holidaysService.deleteByYear(parseInt(year));
    return { code: 200, msg: `${year}年节假日数据已删除`, data: result };
  }
}