import { Controller, Get, Query } from '@nestjs/common'
import { StatutoryHolidaysService } from './statutory-holidays.service'

@Controller('statutory-holidays')
export class StatutoryHolidaysController {
  constructor(private readonly service: StatutoryHolidaysService) {}

  @Get()
  async findAll(@Query('year') year?: string) {
    try {
      const result = await this.service.findAll(year ? parseInt(year, 10) : undefined)
      return { code: 200, msg: 'success', data: result.data }
    } catch (err: any) {
      return { code: 500, msg: err.message || '查询失败', data: null }
    }
  }

  @Get('years')
  async getYears() {
    try {
      const result = await this.service.getYears()
      return { code: 200, msg: 'success', data: result.data }
    } catch (err: any) {
      return { code: 500, msg: err.message || '查询失败', data: null }
    }
  }
}