import * as crypto from 'crypto';
import * as path from 'path';

/**
 * 简易 JWT 工具（HS256）
 * - signToken: 为 payload 追加 exp 后生成 header.payload.signature 三段式 JWT
 * - verifyToken: 校验签名与 exp，通过返回 payload，失败返回 null
 */

// 密钥进程内缓存，避免每次请求重复读盘
let cachedSecret: string | undefined;

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64urlDecode = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sign = (data: string, secret: string): string =>
  base64url(crypto.createHmac('sha256', secret).update(data).digest());

/**
 * 读取 JWT 密钥；缺失时按候选路径兜底加载项目根目录 .env 后重试。
 * 生产环境必须通过部署环境变量提供强随机密钥（>=32 位）。
 */
const ENV_CANDIDATE_PATHS = [
  // 服务进程 cwd 可能为项目根目录或 server 目录，两者都尝试
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  // 编译产物 dist（dist/auth 或 dist/src/auth）向上回溯到项目根
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env')
];

const resolveSecret = (): string | undefined => {
  if (cachedSecret) return cachedSecret;
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    const fs = require('fs') as typeof import('fs');
    for (const envPath of ENV_CANDIDATE_PATHS) {
      try {
        if (!fs.existsSync(envPath)) continue;
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^JWT_SECRET\s*=\s*(.+)\s*$/m);
        if (match && match[1]) {
          secret = match[1].trim().replace(/^["']|["']$/g, '');
          if (secret) break;
        }
      } catch {
        // 单个候选路径读取失败时继续尝试下一个
      }
    }
  }
  if (secret) cachedSecret = secret;
  return secret;
};

export function signToken(
  payload: Record<string, unknown>,
  expiresInSeconds: number
): string {
  const secret = resolveSecret();
  if (!secret) {
    throw new Error('JWT_SECRET 未配置，无法签发令牌');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const secret = resolveSecret();
  if (!secret) return null;
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return null;
    if (
      typeof (payload as { exp?: unknown }).exp !== 'number' ||
      (payload as { exp: number }).exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
