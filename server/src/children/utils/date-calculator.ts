/**
 * 日期计算工具
 * 根据课程类型、报读时长、开始日期计算结束日期
 * 支持工作日、自然月、周六计数
 * 节假日数据按国务院安排，每年需更新
 */

// ====== 2026年法定节假日（国务院安排） ======
// 格式：YYYY-MM-DD
const HOLIDAYS_2026 = new Set<string>([
  // 元旦：1月1日-1月3日
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  // 春节：2月17日-2月23日（除夕2月16日，假期从2月15日周日开始）
  '2026-02-15',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  // 清明节：4月4日-4月6日
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  // 劳动节：5月1日-5月3日
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  // 端午节：5月27日-5月29日
  '2026-05-27',
  '2026-05-28',
  '2026-05-29',
  // 中秋节：9月25日-9月27日
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  // 国庆节：10月1日-10月7日
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
])

// ====== 2026年补班日（周末上班） ======
const WORK_WEEKENDS_2026 = new Set<string>([
  '2026-02-14', // 春节调休
  '2026-02-28', // 春节调休
  '2026-05-30', // 端午节调休
  '2026-10-10', // 国庆调休
])

/**
 * 判断某天是否为工作日
 * 规则：周一至周五（非节假日）+ 补班日（即使周末也算工作日）
 * 非工作日：周六日（非补班日）+ 法定节假日
 */
function isWorkingDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = date.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // 补班日：即使周末也算工作日
  if (WORK_WEEKENDS_2026.has(dateStr)) {
    return true
  }

  // 法定节假日：即使工作日也算非工作日
  if (HOLIDAYS_2026.has(dateStr)) {
    return false
  }

  // 正常周末（周六日）
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }

  // 正常工作日（周一至周五）
  return true
}

/**
 * 判断某天是否为周六且非节假日
 * 补班日不算周六（因为补班日本身是工作日）
 */
function isNonHolidaySaturday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = date.getUTCDay()

  // 不是周六
  if (dayOfWeek !== 6) return false

  // 补班日不算周六
  if (WORK_WEEKENDS_2026.has(dateStr)) return false

  // 节假日不算
  if (HOLIDAYS_2026.has(dateStr)) return false

  return true
}

/**
 * 从开始日期往后推 numDays 个工作日
 * 包含开始日期，即从 startDate 开始算第1个工作日
 */
function addWorkingDays(startDate: string, numDays: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  const current = new Date(Date.UTC(y, m - 1, d))
  let count = 0

  while (count < numDays) {
    const dateStr = current.toISOString().split('T')[0]
    if (isWorkingDay(dateStr)) {
      count++
      if (count === numDays) break
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return current.toISOString().split('T')[0]
}

/**
 * 从开始日期往后推 numDays 个自然月
 * 使用 UTC 避免时区偏移导致日期偏差
 */
function addCalendarMonths(startDate: string, numMonths: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  const totalMonths = (m - 1) + numMonths
  const targetYear = y + Math.floor(totalMonths / 12)
  const targetMonth = totalMonths % 12
  // 处理目标月份的天数上限（如1月31日+1个月=2月28日）
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(d, lastDay)
  const result = new Date(Date.UTC(targetYear, targetMonth, targetDay))
  return result.toISOString().split('T')[0]
}

/**
 * 从开始日期往后推第 numDays 个周六（非节假日）
 * 包含开始日期，即从 startDate 开始算第1个周六
 */
function addSaturdays(startDate: string, numDays: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  const current = new Date(Date.UTC(y, m - 1, d))
  let count = 0

  while (count < numDays) {
    const dateStr = current.toISOString().split('T')[0]
    if (isNonHolidaySaturday(dateStr)) {
      count++
      if (count === numDays) break
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return current.toISOString().split('T')[0]
}

/**
 * 获取报读时长对应的天数
 */
function getDurationDays(duration: string, customDays: string): number {
  switch (duration) {
    case '一周体验': return 5 // 5个工作日
    case '1个月': return 1 // 1个自然月
    case '3个月': return 3
    case '6个月': return 6
    case '12个月': return 12
    case '其他': return parseInt(customDays) || 0
    default: return 0
  }
}

/**
 * 根据课程类型判断报读时长是否使用自然月计算
 */
function isCalendarMonthDuration(duration: string): boolean {
  return ['1个月', '3个月', '6个月', '12个月'].includes(duration)
}

/**
 * 计算结束日期
 * @param startDate 开始日期 YYYY-MM-DD
 * @param courseType 课程类型（全日托/半日托/晚间托/周六托/兴趣班）
 * @param enrollmentDuration 报读时长（一周体验/1个月/3个月/6个月/12个月/其他）
 * @param customDays 自定义天数（仅"其他"时有效）
 * @returns 结束日期 YYYY-MM-DD | ''
 */
export function calculateEndDate(
  startDate: string,
  courseType: string,
  enrollmentDuration: string,
  customDays: string,
): string {
  if (!startDate || !enrollmentDuration) return ''

  const isSaturdayType = courseType === '周六托' || courseType === '兴趣班'
  const days = getDurationDays(enrollmentDuration, customDays)

  if (days <= 0) return ''

  if (isSaturdayType) {
    // 周六托/兴趣班：数第X个周六
    return addSaturdays(startDate, days)
  }

  if (isCalendarMonthDuration(enrollmentDuration)) {
    // 自然月计算
    return addCalendarMonths(startDate, days)
  }

  // 工作日计算（一周体验、其他）
  return addWorkingDays(startDate, days)
}