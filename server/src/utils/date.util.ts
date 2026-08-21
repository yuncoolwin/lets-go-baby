/**
 * 日期工具函数，统一使用 Date.UTC 避免时区问题
 */

/**
 * 解析日期字符串 "YYYY-MM-DD" 为 Date 对象（UTC）
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * 判断日期是否为周六或周日
 */
export function isWeekend(dateStr: string): boolean {
  const d = parseDate(dateStr);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * 判断日期是否为周六
 */
export function isSaturday(dateStr: string): boolean {
  const d = parseDate(dateStr);
  return d.getUTCDay() === 6;
}

/**
 * 日期加减，返回 YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d) + days));
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(date.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * 计算两个日期相差的天数（start - end），返回绝对值
 */
export function diffDays(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  return Math.abs(Math.floor((e.getTime() - s.getTime()) / 86400000));
}

/**
 * 获取 Asia/Shanghai 时区的"今天"日期字符串（YYYY-MM-DD）
 * 避免使用 toISOString（UTC）在凌晨（北京时间 0:00-8:00）偏一天
 */
export function getShanghaiToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value || '';
  const m = parts.find(p => p.type === 'month')?.value || '';
  const d = parts.find(p => p.type === 'day')?.value || '';
  return `${y}-${m}-${d}`;
}