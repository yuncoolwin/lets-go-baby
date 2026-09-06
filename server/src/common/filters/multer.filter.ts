import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError, HttpException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let code = 400;
    let msg = '视频上传失败';

    if (exception instanceof MulterError) {
      code = exception.code === 'LIMIT_FILE_SIZE' ? 400 : 400;
      msg = exception.code === 'LIMIT_FILE_SIZE' ? '视频大小超出10MB限制' : '视频上传失败：' + exception.message;
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // NestJS 对 Multer 大小超限默认抛 PayloadTooLargeException(413)，按需求统一返回 400
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        msg = '视频大小超出10MB限制';
      } else {
        const resp = exception.getResponse();
        msg = typeof resp === 'string' ? resp : String((resp as any)?.message || exception.message);
      }
      code = 400;
    }

    res.status(code).json({ code, msg, data: null });
  }
}