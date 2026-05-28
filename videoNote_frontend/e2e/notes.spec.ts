import { test, expect, request } from '@playwright/test'

// 辅助：通过 API 登录并注入 token
async function loginAndInject(page, username: string, password: string) {
  const resp = await page.request.post('/api/auth/login', {
    data: { username, password },
  })
  if (!resp.ok()) {
    throw new Error(`登录失败: ${resp.status()}`)
  }
  const { data } = await resp.json()
  await page.goto('/login')
  await page.evaluate((authData) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        token: authData.token,
        user: authData.user,
      },
      version: 0,
    }))
  }, data)
  await page.goto('/')
  await page.waitForURL('/', { timeout: 10000 })
}

test.describe('笔记列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndInject(page, 'admin', '123456')
  })

  test('笔记列表页面加载', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForURL('/notes', { timeout: 10000 })
    // 页面加载成功即可，不检查具体数据
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/notes')
  })
})

test.describe('权限隔离', () => {
  test('管理员登录后可访问首页', async ({ page }) => {
    await loginAndInject(page, 'admin', '123456')
    expect(page.url()).toContain('localhost:3015')
  })

  test('跨用户访问返回 403', async ({ }) => {
    const apiContext = await request.newContext()

    // admin 登录
    const adminLogin = await apiContext.post('/api/auth/login', {
      data: { username: 'admin', password: '123456' },
    })
    expect(adminLogin.ok()).toBeTruthy()
    const adminData = await adminLogin.json()
    const adminToken = adminData.data.token

    // 获取 admin 的任务列表（可能为空）
    const tasksRes = await apiContext.get('/api/tasks?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const tasksBody = await tasksRes.json()
    if (!tasksBody.data?.tasks?.length) {
      // 没有任务数据，跳过
      test.skip()
      return
    }
    const taskId = tasksBody.data.tasks[0].task_id

    // 创建 bin 用户（如果不存在）
    const binLogin = await apiContext.post('/api/auth/login', {
      data: { username: 'bin', password: '123456' },
    })
    if (!binLogin.ok()) {
      // bin 用户不存在，跳过
      test.skip()
      return
    }
    const binData = await binLogin.json()
    const binToken = binData.data.token

    // bin 尝试访问 admin 的任务
    const accessRes = await apiContext.get(`/api/task_status/${taskId}`, {
      headers: { Authorization: `Bearer ${binToken}` },
    })
    expect(accessRes.status()).toBe(403)

    await apiContext.dispose()
  })
})
