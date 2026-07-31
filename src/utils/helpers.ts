/**
 * 工具函数库
 */

/**
 * 获取姓名首字（用于头像显示）
 */
export function getNameInitial(name: string): string {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}
