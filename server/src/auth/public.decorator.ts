import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记无需鉴权的公开接口（登录入口等过渡期接口）
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
