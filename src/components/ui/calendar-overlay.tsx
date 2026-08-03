import { View, Text } from '@tarojs/components'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'

interface CalendarOverlayProps {
  visible: boolean
  onClose: () => void
  value: string
  onChange: (dateStr: string) => void
  disabled?: (date: Date) => boolean
}

export function CalendarOverlay({
  visible,
  onClose,
  value,
  onChange,
  disabled,
}: CalendarOverlayProps) {
  if (!visible) return null

  const selectedDate = value ? new Date(value) : new Date()

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      onClose()
    }
  }

  return (
    <View
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.25)' }}
      onClick={onClose}
    >
      {/* 点击遮罩关闭 */}
      <View style={{ flex: 1 }} onClick={onClose} />

      {/* 日历弹窗 - 居中全宽 */}
      <View
        style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '16px 12px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部栏：关闭按钮 */}
        <View style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Text
            style={{ color: '#E8651A', fontSize: 14, fontWeight: 500, padding: '4px 8px' }}
            onClick={onClose}
          >
            完成
          </Text>
        </View>

        {/* 日历组件 */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabled}
        />
      </View>
    </View>
  )
}