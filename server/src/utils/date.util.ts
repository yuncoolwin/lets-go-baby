/**
 * 日期工具函数
 * 统一使用 UTC+8 时区解析日期字符串，避免时区问题
 */

/**
 * 解析日期字符串为 Date 对象
 * 统一使用 UTC+8 时区，避免 new Date(dateStr) 在不同时区返回不同结果
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00+08:00');
}

/**
 * 判断日期是否为周末（周六或周日）
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
 * 日期加减，返回 YYYY-MM-DD 格式
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/**
 * 计算两个日期相差的天数
 */
export function diffDays(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  return Math.round((e.getTime() - s.getTime()) / 86400000);
}

/**
 * 格式化 Date 对象为 YYYY-MM-DD 字符串
 */
export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取当前日期字符串 YYYY-MM-DD
 */
export function today(): string {
  return formatDate(new Date());
}