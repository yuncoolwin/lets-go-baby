import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto, UpdateChildDto, ChildQueryDto } from './dto/create-child.dto';

@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

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
