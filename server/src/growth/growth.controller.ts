import { Controller, Get, Post, Put, Delete, Body, Query, Param, HttpCode, Req, BadRequestException, UseInterceptors, UploadedFile, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GrowthService } from './growth.service';
import { MulterExceptionFilter } from '../common/filters/multer.filter';

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

  @Post('upload-video')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        // 兼容 小程序/H5 上传：MIME 可能是 octet-stream 或缺省，但确为 mp4
        const nameIsMp4 = (file.originalname || '').toLowerCase().endsWith('.mp4');
        const isMp4Mime = file.mimetype === 'video/mp4';
        const isOpaque = !file.mimetype || file.mimetype === 'application/octet-stream';
        if (!isMp4Mime && !(isOpaque && nameIsMp4)) {
          return cb(new BadRequestException('仅支持 video/mp4 格式视频'), false);
        }
        return cb(null, true);
      },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  async uploadVideo(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.uploadVideo(userId, file);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('library/upload-image')
  @HttpCode(200)
  async uploadLibraryImage(@Req() req: Request, @Body() body: { image: string; name?: string }) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.uploadLibraryImage(userId, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('library/upload-video')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const nameIsMp4 = (file.originalname || '').toLowerCase().endsWith('.mp4');
        const isMp4Mime = file.mimetype === 'video/mp4';
        const isOpaque = !file.mimetype || file.mimetype === 'application/octet-stream';
        if (!isMp4Mime && !(isOpaque && nameIsMp4)) {
          return cb(new BadRequestException('仅支持 video/mp4 格式视频'), false);
        }
        return cb(null, true);
      },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  async uploadLibraryVideo(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.uploadLibraryVideo(userId, file);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('library')
  @HttpCode(200)
  async getLibrary(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.getLibrary(userId, Number(page) || 1, Number(pageSize) || 20);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete('library/batch')
  @HttpCode(200)
  async deleteLibraryMediaBatch(@Req() req: Request, @Body() body: { ids?: string[] }) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.deleteLibraryMediaBatch(userId, body?.ids ?? []);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Delete('library/:id')
  @HttpCode(200)
  async deleteLibraryMedia(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.deleteLibraryMedia(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Post('sign-urls')
  @HttpCode(200)
  async signUrls(@Req() req: Request, @Body() dto: { photo_urls?: string[] }) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.signDraftUrls(userId, dto);
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
    dto: { child_id: string; title: string; content?: string; photo_urls?: string[]; video_urls?: string[]; record_date?: string; course_name?: string },
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

  // ============ 云端草稿（教职身份，家长 403） ============
  @Post('drafts')
  @HttpCode(200)
  async draftsUpSert(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.draftsUpSert(userId, body);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get('drafts')
  @HttpCode(200)
  async draftsList(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.draftsList(userId);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data: data.drafts };
  }

  @Get('drafts/:id')
  @HttpCode(200)
  async draftsFindOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.draftsFindOne(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data: data.draft };
  }

  @Delete('drafts/:id')
  @HttpCode(200)
  async draftsDelete(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.userId;
    const data = await this.growthService.draftsDelete(userId, id);
    if (data?.error) {
      return { code: data.code, msg: data.msg, data: null };
    }
    return { code: 200, msg: 'success', data: null };
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
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: { title?: string; content?: string; photo_urls?: string[]; video_urls?: string[]; record_date?: string }) {
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
