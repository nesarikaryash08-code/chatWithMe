import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
async function pageFor(options = {}) {
 const context = await browser.newContext(options); const page = await context.newPage();
 page.on('pageerror', e => errors.push(e.message)); await page.goto(base);
 await page.waitForFunction(() => document.getElementById('city').value === 'Pune' && !document.getElementById('find').disabled);
 return { context, page };
}
try {
 const a = await pageFor({ geolocation: { latitude: 18.52, longitude: 73.85 }, permissions: ['geolocation'], viewport: { width: 1440, height: 1100 } });
 const b = await pageFor({ geolocation: { latitude: 51.5, longitude: -.1 }, permissions: ['geolocation'] });
 for (const { page } of [a,b]) {
  for (const scope of ['city', 'region', 'country', 'nearby', 'world']) {
   await page.locator(`[data-scope="${scope}"]`).click();
   await page.locator('#prefer-nearest').check();
   assert.equal(await page.locator('#prefer-nearest').isChecked(), true);
  }
  await page.locator('[data-scope="city"]').click(); assert.equal(await page.locator('#prefer-nearest').isChecked(), true, 'city preference should be remembered');
  await page.locator('#prefer-nearest').uncheck();
  await page.locator('[data-scope="world"]').click(); assert.equal(await page.locator('#prefer-nearest').isChecked(), true, 'world preference should be independent');
  assert.equal(await page.locator('#location-fields').isVisible(), false);
  await page.locator('#adult').check();
 }
 await a.page.locator('#share-city').check();
 await b.page.locator('#share-city').check();
 await b.page.locator('#country').selectOption('GB');
 await b.page.waitForFunction(() => [...document.getElementById('region').options].some(o => o.value === 'ENG'));
 await b.page.locator('#region').selectOption('ENG');
 await b.page.locator('#cities option[value="London"]').waitFor({ state: 'attached' });
 await b.page.locator('#city').fill('London');
 await a.page.screenshot({ path: '/tmp/chatwithme-worldwide.png', fullPage: true });
 await a.page.locator('#find').click(); await a.page.waitForFunction(() => document.getElementById('find').textContent.includes('Finding someone'));
 assert.equal(await a.page.locator('#prefer-nearest').isDisabled(), true);
 await b.page.locator('#find').click();
 for (const { page } of [a,b]) { await page.waitForFunction(() => !document.getElementById('message').disabled); assert.match(await page.locator('#chat-subtitle').textContent(), /Worldwide · Nearest first/); }
 assert.equal(await a.page.locator('#partner-location').textContent(), 'London, United Kingdom');
 assert.equal(await b.page.locator('#partner-location').textContent(), 'Pune, India');
 assert.equal(await a.page.locator('#location-source').textContent(), 'Shared location');
 await a.page.screenshot({ path: '/tmp/chatwithme-shared-location.png', fullPage: true });
 await a.page.locator('#message').fill('Hello, world!'); await a.page.locator('#send').click(); await b.page.getByText('Hello, world!', { exact: true }).waitFor();
 await a.context.close(); await b.context.close();
 const denied = await pageFor({ viewport: { width: 390, height: 844 } }); const page = denied.page;
 await page.locator('[data-scope="world"]').click(); await page.locator('#prefer-nearest').check(); await page.locator('#adult').check(); await page.locator('#find').click();
 await page.locator('#form-error').filter({ hasText: 'Location unavailable' }).waitFor();
 assert.equal(await page.locator('#prefer-nearest').isChecked(), true, 'denial must not silently disable nearest');
 assert.equal(await page.locator('#cancel').isVisible(), false, 'denial must not join a queue');
 await page.locator('#prefer-nearest').uncheck(); await page.locator('#find').click(); await page.getByText('Waiting for someone from any country.').waitFor(); await page.locator('#cancel').click();
 // Simulate a slow location prompt: cancel must invalidate its eventual callback.
 await page.evaluate(() => {
  window.sentEvents = []; const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) { window.sentEvents.push(JSON.parse(data).type); return send.call(this, data); };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success) { setTimeout(() => success({ coords: { latitude: 18.5, longitude: 73.9 } }), 700); } } });
 });
 await page.locator('#prefer-nearest').check(); await page.locator('#find').click(); await page.locator('#cancel').click();
 await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(() => window.sentEvents.includes('join')), false, 'cancelled location lookup must not later enqueue');
 assert.equal(await page.locator('#find').isDisabled(), false);
 await page.screenshot({ path: '/tmp/chatwithme-worldwide-mobile.png', fullPage: true });
 assert.deepEqual(errors, []);
 console.log('Matching browser checks passed: all scope toggles, independent preferences, Worldwide nearest chat across continents, location denial, random fallback by choice, cancelled location lookup, correct partner city/country in Worldwide matching.');
} finally { await browser.close(); }
