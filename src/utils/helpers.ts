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

/** 关系映射：英文 → 中文 */
export const RELATIONSHIP_MAP: Record<string, string> = {
  father: '爸爸',
  mother: '妈妈',
  grandfather: '爷爷',
  grandmother: '奶奶',
  other: '其他',
}

/** 关系映射：中文 → 英文 */
export const RELATIONSHIP_REVERSE_MAP: Record<string, string> = {
  '爸爸': 'father',
  '妈妈': 'mother',
  '爷爷': 'grandfather',
  '奶奶': 'grandmother',
  '其他': 'other',
}

/** 英文关系值 → 中文标签，找不到时返回原值 */
export function getRelationshipLabel(value: string): string {
  return RELATIONSHIP_MAP[value] || value
}

/** 中文标签 → 英文关系值，找不到时返回原值 */
export function getRelationshipValue(label: string): string {
  return RELATIONSHIP_REVERSE_MAP[label] || label
}
