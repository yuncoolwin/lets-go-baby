import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto, ChildQueryDto } from './dto/create-child.dto';
import { createDateCalculator } from './utils/date-calculator';
import { HolidaysService } from '@/holidays/holidays.service';
import { parseDate } from '@/utils/date.util';

@Controller('children')
export class ChildrenController {
  constructor(
    private readonly childrenService: ChildrenService,
    private readonly holidaysService: HolidaysService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() body: CreateChildDto) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.create(userId, body);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  async findAll(@Req() req: Request, @Query() query: any) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.findAll(userId, query);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('stats')
  @HttpCode(200)
  async getStats() {
    const data = await this.childrenService.getStats();
    return { code: 200, msg: 'success', data };
  }

  @Post('calc-end-date')
  @HttpCode(200)
  async calcEndDate(@Body() body: { start_date: string; course_type: string; enrollment_duration: string; custom_days: string; date_calc_rule?: string }) {
    // 计日类型必须传入天数
    if (body.enrollment_duration === '计日' && (!body.custom_days || parseInt(body.custom_days) <= 0)) {
      return { code: 400, msg: '计日天数不能为空', data: { end_date: '' } };
    }
    // 从数据库读取节假日数据
    try {
      const year = body.start_date ? parseDate(body.start_date).getUTCFullYear() : 2026;
      const { holidays, workWeekends } = await this.holidaysService.getDateSets(year);
      const calculator = createDateCalculator(holidays, workWeekends);
      // 报名时的结束日期：只排除周六日，法定节假日算入工作日
      const endDate = calculator.calculateEndDateWithoutHolidays(
        body.start_date,
        body.course_type,
        body.enrollment_duration,
        body.custom_days || '',
        body.date_calc_rule || '',
      );
      return { code: 200, msg: 'success', data: { end_date: endDate } };
    } catch {
      // 兜底：使用默认硬编码数据
      const calculator = createDateCalculator();
      const endDate = calculator.calculateEndDateWithoutHolidays(
        body.start_date,
        body.course_type,
        body.enrollment_duration,
        body.custom_days || '',
        body.date_calc_rule || '',
      );
      return { code: 200, msg: 'success', data: { end_date: endDate } };
    }
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.findOne(userId, id);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateChildDto) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.update(userId, id, body);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.remove(userId, id);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/assign-class')
  async assignClass(@Req() req: Request, @Param('id') id: string, @Body() body: { class_id: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.childrenService.assignClass(userId, id, body?.class_id);
    if ((data as any)?.error) {
      return { code: (data as any).code, msg: (data as any).msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
