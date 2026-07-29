import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { ClassService } from './class.service';

@Controller('classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Get('detail')
  @HttpCode(200)
  async getClassDetail(@Query('class_id') classId: string) {
    const data = await this.classService.getClassDetail(classId);
    return { code: 200, msg: 'success', data };
  }
}
