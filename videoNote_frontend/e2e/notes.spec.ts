import { test, expect } from '@playwright/test'

test.describe('笔记列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('/')
  })

  test('笔记列表加载并显示数量', async ({ page }) => {
    await page.getByRole('button', { name: '笔记列表' }).click()
    await page.waitForURL('/notes')
    await page.waitForSelector('text=已选择')
    const countText = await page.locator('text=/已选择 \\d+ 行/').textContent()
    expect(countText).toMatch(/已选择 \d+ 行/)
  })

  test('选中 checkbox 计数更新', async ({ page }) => {
    await page.getByRole('button', { name: '笔记列表' }).click()
    await page.waitForURL('/notes')
    await page.waitForSelector('[role="checkbox"]')
    const checkboxes = page.locator('[role="checkbox"]')
    await checkboxes.nth(1).click()
    const countText = await page.locator('text=/已选择 \\d+ 行/').textContent()
    expect(countText).toContain('已选择 1 行')
  })

  test('全选 checkbox', async ({ page }) => {
    await page.getByRole('button', { name: '笔记列表' }).click()
    await page.waitForURL('/notes')
    await page.waitForSelector('[role="checkbox"]')
    await page.locator('[role="checkbox"]').first().click()
    const countText = await page.locator('text=/已选择 \\d+ 行/').textContent()
    const match = countText?.match(/已选择 (\d+) 行/)
    expect(match && parseInt(match[1])).toBeGreaterThan(0)
  })
})