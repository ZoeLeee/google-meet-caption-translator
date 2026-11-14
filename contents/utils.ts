export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const later = () => {
      timeout = null
      return func.apply(this, args)
    }

    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)

    return undefined
  }
}

export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  flush: () => void
  cancel: () => void
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ThrottledFunction<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastTime = 0
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const invoke = () => {
    if (lastArgs) {
      func.apply(lastThis, lastArgs)
      lastArgs = null
      lastThis = null
      lastTime = Date.now()
    }
  }

  const throttled = function(this: any, ...args: Parameters<T>) {
    const now = Date.now()
    const remaining = wait - (now - lastTime)
    lastArgs = args
    lastThis = this

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      invoke()
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null
        invoke()
      }, remaining)
    }
  }

  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    invoke()
  }

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    lastArgs = null
    lastThis = null
  }

  return throttled
}

