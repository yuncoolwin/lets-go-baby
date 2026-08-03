import { View } from '@tarojs/components'
import { useState, useEffect, useRef } from 'react'
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
  const [show, setShow] = useState(false)
  const [scale, setScale] = useState(0.8)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (visible) {
      setShow(true)
      // 触发打开动画：scale 0.8 → 1.0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setScale(1)
        })
      })
    }
  }, [visible])

  const handleClose = () => {
    // 触发关闭动画：scale 1.0 → 0.8
    setScale(0.8)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setShow(false)
      onClose()
    }, 200)
  }

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      handleClose()
    }
  }

  if (!show) return null

  return (
    <View
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
      onClick={handleClose}
    >
      {/* 日历弹窗 - 居中全宽，带缩放动画 */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '12px 12px 16px',
          width: '88%',
          maxWidth: 400,
          transform: `scale(${scale})`,
          transition: 'transform 200ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={value ? new Date(value) : new Date()}
          onSelect={handleSelect}
          disabled={disabled}
        />
      </View>
    </View>
  )
}