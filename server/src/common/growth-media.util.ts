import { getSupabaseClient } from '@/storage/database/supabase-client';

/** 与 GrowthService 保持一致：图片签名 24 小时，视频签名 7 天 */
const SIGNED_URL_TTL = 60 * 60 * 24;
const VIDEO_SIGNED_URL_TTL = 24 * 60 * 60 * 7;

/** 从存储 URL 提取 growth bucket 下的 object path（兼容 public 与 sign 两种 URL） */
export function extractGrowthPath(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const marker = '/object/public/growth/';
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);
  const marker2 = '/object/sign/growth/';
  const idx2 = url.indexOf(marker2);
  if (idx2 >= 0) return url.slice(idx2 + marker2.length).split('?')[0];
  return null;
}

/**
 * 为 growth bucket 的存储 URL 列表按需生成新的签名 URL（读端调用）。
 * bucket 为 private，持久化的签名 URL 会过期，读端需重新签名才能正常访问/下载。
 * @param urls 原始 URL 列表；可为 null
 * @param opts.video  是否为视频（视频 TTL 7 天，否则图片 TTL 24 小时）
 */
export async function signGrowthUrls(
  urls: string[] | null | undefined,
  opts?: { video?: boolean },
): Promise<string[] | null> {
  if (!Array.isArray(urls) || urls.length === 0) return Array.isArray(urls) ? urls : null;
  const client = getSupabaseClient();
  const ttl = opts?.video ? VIDEO_SIGNED_URL_TTL : SIGNED_URL_TTL;
  const signed = new Map<string, string>();
  const paths = urls.map((u) => extractGrowthPath(u)).filter((p): p is string => !!p);
  for (const p of paths) {
    const { data } = await client.storage.from('growth').createSignedUrl(p, ttl);
    if (data?.signedUrl) signed.set(p, data.signedUrl);
  }
  return urls.map((url) => {
    const p = extractGrowthPath(url);
    return (p && signed.get(p)) || url;
  });
}