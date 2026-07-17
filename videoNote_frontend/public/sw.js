/**
 * VideoNote Service Worker
 *
 * 策略：
 * - 仅在生产环境缓存静态资源（dev 模式下 Vite HMR + chunk 版本号会导致缓存失效报错）
 * - 导航请求：network-first，失败降级到缓存的 index.html（SPA fallback）
 * - 静态资源：stale-while-revalidate，所有 fetch 都包 try/catch，绝不 reject
 * - API/上传等动态请求：直接放行，不拦截
 */

const CACHE_NAME = 'videonote-app-shell-v1'
const APP_SHELL = ['/', '/index.html', '/logo.png', '/pwa-192.png', '/pwa-512.png', '/manifest.webmanifest']

// 这些前缀的请求一律放行，SW 不拦截、不缓存
const NETWORK_ONLY_PREFIXES = ['/api/', '/uploads/', '/static/', '/@', '/node_modules/']

// 不应缓存的文件后缀（source map、HMR 元数据等）
const NO_CACHE_EXTENSIONS = ['.map', '.hot-update.json', '.hot-update.js']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(cacheNames.filter(cacheName => cacheName !== CACHE_NAME).map(cacheName => caches.delete(cacheName)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  // 只拦截 GET，其他方法放行
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // 跨域请求放行
  if (url.origin !== self.location.origin) {
    return
  }

  // API / 上传 / Vite 内部路径放行
  if (NETWORK_ONLY_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
    return
  }

  // source map / HMR 文件放行
  if (NO_CACHE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    return
  }

  // 开发模式：带版本号/时间戳查询参数的请求放行（Vite chunk: /assets/xxx.js?v=hash）
  if (url.search && (url.searchParams.has('v') || url.searchParams.has('t') || url.searchParams.has('import'))) {
    return
  }

  // 导航请求：network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'))
    return
  }

  // 其他静态资源：stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request))
})

/**
 * Network-first 策略（用于导航请求）
 * 先尝试网络，失败时降级到缓存，再降级到 index.html
 */
async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)
    // 只缓存成功的响应
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => undefined)
    }
    return response
  } catch {
    // 网络失败：尝试缓存 -> fallback
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    const fallback = await cache.match(fallbackPath)
    if (fallback) {
      return fallback
    }
    // 最终兜底：返回 503 而非 reject
    return new Response('离线且无缓存', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}

/**
 * Stale-while-revalidate 策略（用于静态资源）
 * 有缓存先返回缓存 + 后台更新，无缓存尝试网络，全失败返回 503
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    // 后台更新缓存，失败静默忽略
    fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => undefined)
        }
      })
      .catch(() => undefined)

    return cachedResponse
  }

  // 无缓存：尝试网络
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => undefined)
    }
    return response
  } catch {
    // 网络失败且无缓存：返回 503 而非 reject（避免 FetchEvent 报错）
    return new Response('资源不可用', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}
