/**
 * 根据出生日期计算年龄，格式：X岁X个月
 * @param birthDate 出生日期字符串 (YYYY-MM-DD)
 * @returns 格式化后的年龄字符串
 */
export function formatAge(birthDate: string | null | undefined): string {
  if (!birthDate) return ''
  
  const birth = new Date(birthDate)
  const now = new Date()
  
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  
  // 如果当前日期小于出生日期，减1个月
  if (now.getDate() < birth.getDate()) {
    months--
  }
  
  // 调整负数月份
  if (months < 0) {
    years--
    months += 12
  }
  
  // 处理边界情况
  if (years < 0) return '0岁0个月'

  if (years === 0 && months === 0) {
    return '新生儿'
  }

  if (years === 0) {
    return `${months}个月`
  }

  if (months === 0) {
    return `${years}岁整`
  }

  return `${years}岁${months}个月`
}

/**
 * 计算年龄（简化版，只返回岁数）
 */
export function getAge(birthDate: string | null | undefined): number {
  if (!birthDate) return 0
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * 格式化日期为 MM月DD日
 * @param dateStr 日期字符串
 * @returns 格式化后的日期字符串，如 "8月1日"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  // 日期字符串按 UTC 解析，统一使用 UTC getter 避免时区偏移导致偏一天
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${month}月${day}日`
}

/**
 * 安全地格式化时间为 HH:mm，无效日期返回空字符串
 */
export function formatTime(dateStr: string | number | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
