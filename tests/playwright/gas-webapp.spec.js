
const { test, expect } = require('@playwright/test');

test('GAS Web App should load and display title', async ({ page }) => {
  const webAppUrl = process.env.GAS_WEB_APP_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
  await page.goto(webAppUrl);

  // 'h1'タグのテキストが'PM001 Shipping System'であることを確認
  await expect(page.locator('h1')).toHaveText('PM001 Shipping System');
});
