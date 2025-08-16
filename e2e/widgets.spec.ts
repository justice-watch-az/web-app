import { test, expect } from '@playwright/test';

test.describe('Widget System', () => {
  test('stats widget loads successfully', async ({ page }) => {
    await page.goto('/widgets/stats');
    
    // Wait for React to load
    await page.waitForSelector('.widget-container', { timeout: 10000 });
    
    // Check widget is rendered
    const widget = await page.locator('.widget-container');
    await expect(widget).toBeVisible();
  });

  test('arraignments widget loads with parameters', async ({ page }) => {
    await page.goto('/widgets/arraignments?court=all&date=today');
    
    await page.waitForSelector('.widget-container', { timeout: 10000 });
    
    const widget = await page.locator('.widget-container');
    await expect(widget).toBeVisible();
  });

  test('widget gallery allows configuration', async ({ page }) => {
    await page.goto('/widgets/gallery');
    
    await page.waitForSelector('.widget-gallery', { timeout: 10000 });
    
    // Check configurator exists
    const configurator = await page.locator('.widget-configurator');
    await expect(configurator).toBeVisible();
  });

  test('widget sends postMessage on load', async ({ page }) => {
    const messages: any[] = [];
    
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('message', (event) => {
        (window as any).capturedMessages = (window as any).capturedMessages || [];
        (window as any).capturedMessages.push(event.data);
      });
    });
    
    await page.goto('/widgets/stats');
    await page.waitForSelector('.widget-container');
    
    const capturedMessages = await page.evaluate(() => (window as any).capturedMessages || []);
    
    const loadMessage = capturedMessages.find((msg: any) => msg.type === 'WIDGET_LOADED');
    expect(loadMessage).toBeTruthy();
  });

  test('widget API returns valid data', async ({ request }) => {
    const response = await request.get('/api/widgets/config');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.availableWidgets).toBeDefined();
  });

  test('CORS headers are set correctly', async ({ request }) => {
    const response = await request.get('/api/widgets/config', {
      headers: {
        'Origin': 'http://example.com'
      }
    });
    
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('CSP headers allow iframe embedding', async ({ request }) => {
    const response = await request.get('/widgets/stats');
    
    const headers = response.headers();
    const csp = headers['content-security-policy'];
    
    expect(csp).toContain('frame-ancestors');
  });
});