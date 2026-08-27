type DialogBackCallback = () => void

let activeCallback: DialogBackCallback | null = null

/**
 * 注册一个「返回键关闭弹窗」回调。
 * 返回注销函数，供 useEffect 清理使用。
 */
export function registerDialogBack(cb: DialogBackCallback): () => void {
  activeCallback = cb
  return () => {
    if (activeCallback === cb) {
      activeCallback = null
    }
  }
}

/**
 * 消费当前注册的返回回调。若存在则执行并返回 true（表示已拦截返回），
 * 否则返回 false（未拦截，调用方继续执行默认返回）。
 */
export function consumeDialogBack(): boolean {
  if (activeCallback) {
    const cb = activeCallback
    activeCallback = null
    cb()
    return true
  }
  return false
}