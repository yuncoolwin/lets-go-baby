import { useEffect } from 'react'
import { registerDialogBack } from './dialog-back'

/**
 * 弹窗打开时注册「返回键关闭弹窗」回调，关闭时自动注销。
 */
export function useDialogBack(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    return registerDialogBack(onClose)
  }, [open, onClose])
}