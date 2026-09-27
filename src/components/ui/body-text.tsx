import { Text, View } from '@tarojs/components'
import type { CSSProperties } from 'react'

interface BodyTextProps {
  /** 段落文本（支持含换行符的字符串） */
  text?: string | null
  /** 附加样式类：可覆盖文字大小 / 颜色等（会追加在默认排版类之后） */
  className?: string
  /** 是否整段左移（子条款缩进） */
  sub?: boolean
  /** 是否按换行符分段：每段各自首行缩进、空行保留 */
  paragraph?: boolean
  style?: CSSProperties
}

const BASE = 'block text-sm leading-relaxed'

/**
 * 公共正文段落组件：
 * - 默认 block + leading-relaxed + 首行缩进两字符（text-indent: 2em）
 * - 样式集中在组件内维护，需调整缩进/字重时只改此处
 * - 首行缩进量：2em（如需统一调整，改本文件的 INDENT 即可）
 */
const INDENT: CSSProperties = { textIndent: '2em' }

export function BodyText({ text, className = '', sub = false, paragraph = false, style = {} }: BodyTextProps) {
  const indentStyle: CSSProperties = { ...INDENT, ...style }

  if (!paragraph || !text?.includes('\n')) {
    return (
      <Text className={`${BASE} ${className} ${sub ? 'pl-5' : ''}`} style={indentStyle}>
        {text}
      </Text>
    )
  }

  const segments = (text ?? '').split('\n')
  return (
    <View className={`block ${sub ? 'pl-5' : ''}`}>
      {segments.map((seg, i) =>
        seg.trim() === '' ? (
          <View key={i} className="h-4" />
        ) : (
          <Text key={i} className={`${BASE} ${className}`} style={indentStyle}>
            {seg}
          </Text>
        ),
      )}
    </View>
  )
}