import { test, expect } from '@playwright/test'
import { request } from '@playwright/test'

test.describe('权限隔离', () => {
  test('管理员只能看到自己的笔记', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/')
    await page.getByRole('button', { name: '笔记列表' }).click()
    await page.waitForURL('/notes')
    await page.waitForSelector('text=/已选择 \\d+ 行/')
    // admin user_id=1, 应看到自己的笔记数量
  })

  test('普通用户只能看到自己的笔记', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('bin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/')
    await page.getByRole('button', { name: '笔记列表' }).click()
    await page.waitForURL('/notes')
    await page.waitForSelector('text=/已选择 \\d+ 行/')
    // bin user_id=2, 只应看到 1 条
    const countText = await page.locator('text=/已选择 \\d+ 行/').textContent()
    expect(countText).toContain('共 1 行')
  })

  test('跨用户访问返回 403', async ({ playwright }) => {
    const adminCtx = await request.newContext()
    const adminLogin = await adminCtx.post('http://localhost:8483/api/auth/login', {
      data: { username: 'admin', password: '123456' },
    })
    const adminToken = await adminLogin.json().then(r => r.data.token)

    const binCtx = await request.newContext()
    const binLogin = await binCtx.post('http://localhost:8483/api/auth/login', {
      data: { username: 'bin', password: '123456' },
    })
    const binToken = await binLogin.json().then(r => r.data.token)

    // 获取管理员的一个任务
    const tasksRes = await adminCtx.get('http://localhost:8483/api/tasks?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const tasks = await tasksRes.json().then(r => r.data.tasks)
    const taskId = tasks[0].task_id

    // bin 尝试访问管理员的任务
    const accessRes = await binCtx.get(`http://localhost:8483/api/task_status/${taskId}`, {
      headers: { Authorization: `Bearer ${binToken}` },
    })
    expect(accessRes.status()).toBe(403)
  })
})