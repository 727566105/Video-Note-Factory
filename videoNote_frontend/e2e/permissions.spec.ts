import { test, expect, request } from '@playwright/test'

test.describe('权限隔离', () => {
  test('管理员可正常登录', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/', { timeout: 15000 })
    expect(page.url()).toContain('localhost:3015')
  })

  test('管理员可访问笔记列表页', async ({ page }) => {
    // API 登录注入 token
    const resp = await page.request.post('/api/auth/login', {
      data: { username: 'admin', password: '123456' },
    })
    if (!resp.ok()) {
      test.skip()
      return
    }
    const { data } = await resp.json()
    await page.goto('/login')
    await page.evaluate((authData) => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: { token: authData.token, user: authData.user },
        version: 0,
      }))
    }, data)
    await page.goto('/notes')
    await page.waitForURL('/notes', { timeout: 10000 })
    expect(page.url()).toContain('/notes')
  })

  test('跨用户 API 访问返回 403', async ({ }) => {
    const apiContext = await request.newContext()

    const adminLogin = await apiContext.post('/api/auth/login', {
      data: { username: 'admin', password: '123456' },
    })
    if (!adminLogin.ok()) {
      test.skip()
      return
    }
    const adminData = await adminLogin.json()
    const adminToken = adminData.data.token

    const tasksRes = await apiContext.get('/api/tasks?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const tasksBody = await tasksRes.json()
    if (!tasksBody.data?.tasks?.length) {
      test.skip()
      return
    }
    const taskId = tasksBody.data.tasks[0].task_id

    const binLogin = await apiContext.post('/api/auth/login', {
      data: { username: 'bin', password: '123456' },
    })
    if (!binLogin.ok()) {
      test.skip()
      return
    }
    const binData = await binLogin.json()
    const binToken = binData.data.token

    const accessRes = await apiContext.get(`/api/task_status/${taskId}`, {
      headers: { Authorization: `Bearer ${binToken}` },
    })
    expect(accessRes.status()).toBe(403)

    await apiContext.dispose()
  })
})
