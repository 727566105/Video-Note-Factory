import { test, expect } from '@playwright/test'

test.describe('认证流程', () => {
  test('登录成功后跳转首页', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/')
    expect(page.url()).toBe('http://localhost:3015/')
  })

  test('登录失败显示错误提示', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('wrongpassword')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForSelector('text=用户名或密码错误')
  })

  test('未登录访问笔记列表重定向到登录页', async ({ page }) => {
    await page.goto('/notes')
    await page.waitForURL('/login')
    expect(page.url()).toContain('/login')
  })

  test('退出登录后跳转到登录页', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/')
    await page.getByRole('button', { name: /admin/ }).click()
    await page.getByRole('menuitem', { name: '退出登录' }).click()
    await page.waitForURL('/login')
  })
})