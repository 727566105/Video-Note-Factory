/**
 * Service Worker 注册/注销
 *
 * 仅在生产环境注册 SW。
 * 开发模式下主动注销旧 SW（避免 prod 构建遗留的 SW 干扰 Vite HMR）。
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  // 开发模式：注销所有残留的 SW，避免缓存干扰 HMR
  if (!import.meta.env.PROD) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(reg => reg.unregister()))
      if (regs.length > 0) {
        console.info('[VideoNote] 开发模式：已注销残留 Service Worker')
      }
    } catch {
      // 忽略
    }
    return
  }

  // 生产模式：注册 SW
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('[VideoNote] Service worker registration failed:', error)
    })
  })
}
