import '@testing-library/jest-dom/vitest'

// 兼容 Node 26 实验性 localStorage 与 jsdom 的冲突：
// Node 26 自带实验性 globalThis.localStorage（未传 --localstorage-file 时为 undefined），
// 在 vitest jsdom 环境下会遮蔽 jsdom 提供的 window.localStorage，导致组件/测试读不到。
// 这里用内存实现兜底，保证组件内 localStorage 读写可用。
const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

const storage = createMemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
})
if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

// Radix/部分组件依赖 ResizeObserver，jsdom 未实现，需兜底
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub,
    configurable: true,
    writable: true,
  })
}

// Radix Select 的 pointerdown 处理器会调用 target.hasPointerCapture/setPointerCapture，
// jsdom 的 Element 原型缺这些方法（React 事件系统包装后 target 上不存在），补 no-op 兜底
if (typeof Element !== 'undefined' && typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
