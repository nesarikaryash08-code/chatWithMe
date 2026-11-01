import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
 const first = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
 const second = await browser.newContext();
 const a = await first.newPage(), b = await second.newPage();
 for (const page of [a,b]) { page.on('pageerror', e => errors.push(e.message)); await page.goto(base); await page.waitForFunction(() => document.getElementById('city').value === 'Pune' && !document.getElementById('find').disabled); }
 await a.screenshot({ path: '/tmp/chatwithme-desktop.png', fullPage: true });
 await a.getByRole('button', { name: 'How it works' }).click(); await a.getByRole('heading', { name: 'One place. Two strangers.' }).waitFor(); await a.getByRole('button', { name: 'Close dialog' }).click();
 for (const page of [a,b]) { await page.locator('#adult').check(); await page.locator('#find').click(); }
 for (const page of [a,b]) await page.locator('#message').waitFor({ state: 'visible' });
 await a.waitForFunction(() => !document.getElementById('message').disabled);
 assert.equal(await a.locator('#partner-location').textContent(), 'Pune, India');
 assert.equal(await b.locator('#partner-location').textContent(), 'Pune, India');
 await a.locator('[data-opener]').first().click();
 assert.equal(await a.locator('#message').inputValue(), 'What’s your perfect spontaneous plan?');
 assert.equal(await b.locator('.message-bubble').count(), 0, 'Opening lines should be drafts, not automatically sent');
 await a.locator('#send').click();
 await b.getByText('What’s your perfect spontaneous plan?', { exact: true }).waitFor();
 await a.locator('#message').fill('Hello from Pune!'); await a.locator('#send').click();
 await b.getByText('Hello from Pune!', { exact: true }).waitFor();
 await b.locator('#message').fill('Hey! A spontaneous coffee and a long walk. What about you?'); await b.locator('#send').click();
 await a.getByText('Hey! A spontaneous coffee and a long walk. What about you?', { exact: true }).waitFor();
 await a.screenshot({ path: '/tmp/chatwithme-location-chat.png', fullPage: true });
 await b.locator('#message').fill('<img src=x onerror=alert(1)>'); await b.locator('#send').click();
 await a.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
 assert.equal(await a.locator('.message-bubble img').count(), 0);
 await a.screenshot({ path: '/tmp/chatwithme-conversation.png', fullPage: true });
 await a.locator('#block').click(); await a.locator('#confirm-block').click(); await a.getByText('Your comfort comes first.', { exact: true }).first().waitFor();
 await b.getByText('Stranger has left. Choose Find someone to start fresh.').waitFor();
 await a.locator('[data-scope="country"]').click(); await a.locator('#country').selectOption('GB');
 await a.waitForFunction(() => document.getElementById('region').options[0]?.text !== 'Loading regions…');
 await a.locator('#find').click(); await a.getByText('Looking for your next hello…').waitFor(); await a.locator('#cancel').click();
 await a.waitForFunction(() => !document.getElementById('find').disabled);
 const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
 const m = await mobile.newPage(); m.on('pageerror', e => errors.push(e.message)); await m.goto(base); await m.waitForFunction(() => document.getElementById('city').value === 'Pune');
 assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile horizontal overflow');
 await m.screenshot({ path: '/tmp/chatwithme-mobile.png', fullPage: true });
 for (const width of [320, 768, 1024]) { await m.setViewportSize({ width, height: 900 }); assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`); }
 await m.setViewportSize({ width: 390, height: 844 });
 await m.locator('[data-scope="nearby"]').click(); await m.locator('#nearby-info').waitFor({ state: 'visible' });
 assert.deepEqual(errors, []); console.log('Browser checks passed: desktop/mobile, dialogs, real two-session chat, safe text rendering, block, country search, cancel, nearby mode, opening-line drafts, responsive layouts from 320px.');
} finally { await browser.close(); }
