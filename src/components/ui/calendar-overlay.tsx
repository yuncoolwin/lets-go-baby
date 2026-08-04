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
  const [animating, setAnimating] = useState<'open' | 'close' | 'idle'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (visible) {
      setShow(true)
      setAnimating('idle')
      // 触发打开动画：scale 0.3 → 1.0, opacity 0 → 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating('open')
        })
      })
    }
  }, [visible])

  const handleClose = () => {
    // 触发关闭动画：scale 1.0 → 0.3, opacity 1 → 0
    setAnimating('close')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setShow(false)
      setAnimating('idle')
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
      {/* 日历弹窗 - 居中全宽，带缩放+透明度动画 */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '12px 12px 16px',
          width: '88%',
          maxWidth: 400,
          transform: animating === 'open' ? 'scale(1)' : 'scale(0.3)',
          opacity: animating === 'idle' ? 0 : 1,
          transition: animating === 'open'
            ? 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out'
            : animating === 'close'
            ? 'transform 200ms ease-in, opacity 200ms ease-in'
            : 'none',
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