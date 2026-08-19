import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto, UpdateChildDto, ChildQueryDto } from './dto/create-child.dto';
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
  @HttpCode(200)
  async create(@Body() body: CreateChildDto) {
    const data = await this.childrenService.create(body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  async findAll(@Query() query: ChildQueryDto) {
    const data = await this.childrenService.findAll(query);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
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
  @HttpCode(200)
  async findOne(@Param('id') id: string) {
    const data = await this.childrenService.findOne(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() body: UpdateChildDto) {
    const data = await this.childrenService.update(id, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    const data = await this.childrenService.remove(id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/assign-class')
  @HttpCode(200)
  async assignClass(@Param('id') id: string, @Body() body: { class_id: string }) {
    const data = await this.childrenService.assignClass(id, body.class_id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }
}
