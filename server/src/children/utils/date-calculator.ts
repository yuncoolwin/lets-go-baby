/**
 * 日期计算工具
 * 根据课程类型、报读时长、开始日期计算结束日期
 * 支持工作日、自然月、周六计数
 * 节假日数据可从数据库加载，也可使用默认硬编码数据
 */

// ====== 2026年默认节假日数据（硬编码兜底） ======
const DEFAULT_HOLIDAYS = new Set<string>([
  '2026-01-01', '2026-01-02', '2026-01-03', // 元旦
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', // 春节
  '2026-04-04', '2026-04-05', '2026-04-06', // 清明
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', // 劳动节
  '2026-06-19', '2026-06-20', '2026-06-21', // 端午
  '2026-08-06', '2026-08-07', // 暑假
  '2026-09-25', '2026-09-26', '2026-09-27', // 中秋
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', // 国庆
])

const DEFAULT_WORK_WEEKENDS = new Set<string>([
  '2026-02-14', // 春节调休
  '2026-02-28', // 春节调休
  '2026-03-28', // 清明调休
  '2026-05-09', // 劳动节调休
  '2026-10-10', // 国庆调休
])

/**
 * 创建日期计算器实例
 * @param holidays 节假日日期集合
 * @param workWeekends 补班日日期集合
 */
export function createDateCalculator(
  holidays: Set<string> = DEFAULT_HOLIDAYS,
  workWeekends: Set<string> = DEFAULT_WORK_WEEKENDS,
) {
  function isWorkingDay(dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dayOfWeek = date.getUTCDay()

    if (workWeekends.has(dateStr)) return true
    if (holidays.has(dateStr)) return false
    if (dayOfWeek === 0 || dayOfWeek === 6) return false
    return true
  }

  function isNonHolidaySaturday(dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dayOfWeek = date.getUTCDay()
    if (dayOfWeek !== 6) return false
    if (workWeekends.has(dateStr)) return false
    if (holidays.has(dateStr)) return false
    return true
  }

  function addWorkingDays(startDate: string, numDays: number): string {
    const [y, m, d] = startDate.split('-').map(Number)
    const current = new Date(Date.UTC(y, m - 1, d))
    let count = 0
    while (count < numDays) {
      const dateStr = current.toISOString().slice(0, 10)
      if (isWorkingDay(dateStr)) {
        count++
        if (count === numDays) break
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return current.toISOString().slice(0, 10)
  }

  function addCalendarMonths(startDate: string, numMonths: number): string {
    const [y, m, d] = startDate.split('-').map(Number)
    const totalMonths = (m - 1) + numMonths
    const targetYear = y + Math.floor(totalMonths / 12)
    const targetMonth = totalMonths % 12
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
    const targetDay = Math.min(d, lastDay)
    // 结束日期 = 对应日期 - 1天
    const endDate = new Date(Date.UTC(targetYear, targetMonth, targetDay - 1))
    return endDate.toISOString().slice(0, 10)
  }

  function addSaturdays(startDate: string, numDays: number): string {
    const [y, m, d] = startDate.split('-').map(Number)
    const current = new Date(Date.UTC(y, m - 1, d))
    let count = 0
    while (count < numDays) {
      const dateStr = current.toISOString().slice(0, 10)
      if (isNonHolidaySaturday(dateStr)) {
        count++
        if (count === numDays) break
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return current.toISOString().slice(0, 10)
  }

  function getDurationDays(duration: string, customDays: string): number {
    switch (duration) {
      case '一周体验': return 5
      case '1个月': return 1
      case '3个月': return 3
      case '6个月': return 6
      case '12个月': return 12
      case '计日': return parseInt(customDays) || 0
      default: return 0
    }
  }

  function isCalendarMonthDuration(duration: string): boolean {
    return ['1个月', '3个月', '6个月', '12个月'].includes(duration)
  }

  function calculateEndDate(
    startDate: string,
    courseType: string,
    enrollmentDuration: string,
    customDays: string,
    dateCalcRule?: string,
  ): string {
    if (!startDate || !enrollmentDuration) return ''
    const isSaturdayType = courseType === '周六托' || courseType === '兴趣班'
    // 报读结束日期：只排除周六日，法定节假日算入工作日（不减假期）
    function addWorkingDaysWithoutHolidays(start: string, count: number): string {
      let cur = start
      let added = 0
      while (added < count) {
        const [y, m, d] = cur.split('-').map(Number)
        const dow = new Date(Date.UTC(y, m - 1, d)).getDay()
        if (dow !== 0 && dow !== 6) added++
        const nd = new Date(Date.UTC(y, m - 1, d + 1))
        cur = nd.getUTCFullYear() + '-' + String(nd.getUTCMonth() + 1).padStart(2, '0') + '-' + String(nd.getUTCDate()).padStart(2, '0')
      }
      const [ly, lm, ld] = cur.split('-').map(Number)
      const prev = new Date(Date.UTC(ly, lm - 1, ld - 1))
      return prev.getUTCFullYear() + '-' + String(prev.getUTCMonth() + 1).padStart(2, '0') + '-' + String(prev.getUTCDate()).padStart(2, '0')
    }
    // 如果传入了 dateCalcRule，优先使用它来判断日期计算规则
    const useSaturday = dateCalcRule ? dateCalcRule.includes('周六') : isSaturdayType
    const days = getDurationDays(enrollmentDuration, customDays)
    if (days <= 0) return ''
    if (useSaturday) return addSaturdays(startDate, days)
    if (isCalendarMonthDuration(enrollmentDuration)) return addCalendarMonths(startDate, days)
    // 报读结束日期：法定节假日算入工作日（不减假期），内部逻辑不传 holidays
    return addWorkingDaysWithoutHolidays(startDate, days)
  }

  return { isWorkingDay, isNonHolidaySaturday, addWorkingDays, addCalendarMonths, addSaturdays, calculateEndDate, calculateEndDateWithoutHolidays: calculateEndDate }
}

/** 默认计算器（使用硬编码节假日数据） */
const defaultCalculator = createDateCalculator(DEFAULT_HOLIDAYS, DEFAULT_WORK_WEEKENDS)
export const calculateEndDate = defaultCalculator.calculateEndDate

/** 不含法定节假日的计算器（报名结束日期用） */
const noHolidayCalculator = createDateCalculator(new Set(), new Set())
export const calculateEndDateWithoutHolidays =
  noHolidayCalculator.calculateEndDate