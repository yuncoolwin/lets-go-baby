import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import * as path from 'path';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { AuthGuard } from '@/auth/auth.guard';

// nest 进程 cwd 为 server/，dotenv 默认读 server/.env（不存在），项目根 .env 的配置
// （如 MOCK_WECHAT/CORS_ORIGINS）默认进不了 process.env。此处统一兜底加载：
// 遍历候选路径找到项目根 .env，仅注入进程尚不存在的变量（部署环境变量优先，override=false）。
const ENV_CANDIDATE_PATHS = [
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env')
];
for (const envPath of ENV_CANDIDATE_PATHS) {
  try {
    if (require('fs').existsSync(envPath)) {
      require('dotenv').config({ path: envPath, override: false });
      break;
    }
  } catch {
    // 忽略单个候选路径的读取异常，继续尝试下一个
  }
}

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // CORS_ORIGINS 配置允许的来源（逗号分隔）；未配置时默认放行同源（小程序端无浏览器同源限制）
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()) : false,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 全局鉴权守卫：除 @Public() 标注的接口外，全部要求有效 JWT
  app.useGlobalGuards(new AuthGuard(new Reflector()));
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 \({port} 被占用! 请运行 'npx kill-port \){port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
