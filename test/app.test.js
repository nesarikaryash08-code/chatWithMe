import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { WebSocket } from 'ws';
import { createApp } from '../server.js';
let server, base, dir;
before(async () => { dir = await mkdtemp(`${tmpdir()}/chatwithme-test-`); server = createApp({ reportDirectory: dir }); await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); });
async function client() {
 const response = await fetch(base + '/api/session', { method: 'POST' }); assert.equal(response.status, 200);
 const cookie = response.headers.get('set-cookie').split(';')[0];
 const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { Cookie: cookie } });
 const queue = []; const listeners = [];
 ws.on('message', raw => { const e = JSON.parse(raw); const i = listeners.findIndex(l => l.type === e.type); if (i >= 0) listeners.splice(i, 1)[0].resolve(e); else queue.push(e); });
 const wait = (type, timeout = 2500) => { const i = queue.findIndex(e => e.type === type); if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(`Timeout waiting for ${type}`)), timeout); listeners.push({ type, resolve: e => { clearTimeout(timer); resolve(e); } }); }); };
 await wait('connected');
 return { ws, queue, wait, send: (type, data = {}) => ws.send(JSON.stringify({ type, ...data })), close: async () => { ws.close(); await new Promise(r => ws.once('close', r)); } };
}
const pool = { scope: 'city', country: 'IN', region: 'MH', city: 'Pune' };
async function paired() { const a = await client(), b = await client(); a.send('join', { adult: true, pool }); await a.wait('waiting'); b.send('join', { adult: true, pool }); const [am, bm] = await Promise.all([a.wait('matched'), b.wait('matched')]); assert.equal(am.room, bm.room); return { a, b, room: am.room }; }
test('worldwide location hierarchy and static application work', async () => {
 const countries = await (await fetch(base + '/api/locations')).json(); assert.ok(countries.length > 200); assert.ok(countries.some(c => c.id === 'IN'));
 const states = await (await fetch(base + '/api/locations?country=IN')).json(); assert.ok(states.some(c => c.id === 'MH'));
 const cities = await (await fetch(base + '/api/locations?country=IN&region=MH&q=Pune')).json(); assert.ok(cities.some(c => c.id === 'Pune'));
 const html = await fetch(base); assert.equal(html.status, 200); assert.match(await html.text(), /id="match-form"/);
 assert.equal((await fetch(base + '/server.js')).status, 404);
});
test('two strangers match, type, send and deduplicate messages; rooms reject unauthorized IDs', async () => {
 const { a, b, room } = await paired();
 try {
  a.send('typing'); await b.wait('typing');
  a.send('message', { room: 'wrong-room', id: 'bad', text: 'No' }); assert.match((await a.wait('error')).message, /ended/);
  a.send('message', { room, id: 'hello', text: '<script>hello</script>' }); const msg = await b.wait('message'); assert.equal(msg.text, '<script>hello</script>'); assert.equal(msg.mine, false); assert.equal((await a.wait('message')).mine, true);
  a.send('message', { room, id: 'hello', text: 'duplicate' });
  a.send('leave'); await b.wait('partner_left'); assert.equal(b.queue.filter(e => e.type === 'message').length, 0);
  a.send('join', { adult: true, pool }); b.send('join', { adult: true, pool }); await Promise.all([a.wait('waiting'), b.wait('waiting')]);
 } finally { await a.close(); await b.close(); }
});
test('different scopes do not match; adult consent and valid locations are required', async () => {
 const a = await client(), b = await client();
 try {
  a.send('join', { adult: false, pool }); assert.match((await a.wait('error')).message, /18/);
  a.send('join', { adult: true, pool: { ...pool, city: 'Not-a-city' } }); assert.match((await a.wait('error')).message, /city/);
  a.send('join', { adult: true, pool }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'country', country: 'IN' } }); await b.wait('waiting');
  assert.equal(a.queue.some(e => e.type === 'matched'), false);
  a.send('leave'); await a.wait('left');
  a.send('join', { adult: true, pool: { scope: 'country', country: 'IN' } }); await Promise.all([a.wait('matched'), b.wait('matched')]);
 } finally { await a.close(); await b.close(); }
});
test('reports persist real evidence, block and end the room', async () => {
 const { a, b, room } = await paired();
 try {
  b.send('message', { room, id: 'evidence', text: 'Report evidence' }); await a.wait('message');
  a.send('report', { reason: 'Spam or scam' }); await Promise.all([a.wait('reported'), b.wait('partner_left')]);
  const report = JSON.parse((await readFile(`${dir}/reports.jsonl`, 'utf8')).trim()); assert.equal(report.reason, 'Spam or scam'); assert.equal(report.messages[0].text, 'Report evidence');
  a.send('join', { adult: true, pool }); b.send('join', { adult: true, pool }); await Promise.all([a.wait('waiting'), b.wait('waiting')]);
 } finally { await a.close(); await b.close(); }
});
test('nearby matches only within the distance limit and never exposes coordinates', async () => {
 const a = await client(), b = await client(), c = await client();
 try {
  a.send('join', { adult: true, pool: { scope: 'nearby', lat: 18.52, lon: 73.85 } }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'nearby', lat: 51.5, lon: -.1 } }); await b.wait('waiting');
  c.send('join', { adult: true, pool: { scope: 'nearby', lat: 18.55, lon: 73.8 } });
  const match = await a.wait('matched'); await c.wait('matched'); assert.equal(match.location, 'Within 100 km'); assert.equal(match.lat, undefined); assert.equal(b.queue.some(e => e.type === 'matched'), false);
 } finally { await a.close(); await b.close(); await c.close(); }
});
test('block excludes the pair while a different stranger can match', async () => {
 const { a, b } = await paired(); const c = await client();
 try {
  a.send('block'); await a.wait('blocked'); await b.wait('partner_left');
  a.send('join', { adult: true, pool }); await a.wait('waiting'); b.send('join', { adult: true, pool }); await b.wait('waiting');
  c.send('join', { adult: true, pool }); await c.wait('matched'); await a.wait('matched');
  assert.equal(b.queue.some(e => e.type === 'matched'), false);
 } finally { await a.close(); await b.close(); await c.close(); }
});
test('disconnect notifies partner and an outsider cannot send into a room', async () => {
 const { a, b, room } = await paired(); const c = await client();
 try {
  c.send('message', { room, id: 'intrude', text: 'intrusion' }); assert.match((await c.wait('error')).message, /ended/);
  await a.close(); const event = await b.wait('partner_left'); assert.equal(event.reason, 'disconnected');
  b.send('message', { room, id: 'stale', text: 'after disconnect' }); await b.wait('error');
 } finally { await b.close(); await c.close(); }
});
test('WebSocket upgrade rejects unknown sessions, foreign origins and duplicate session tabs', async () => {
 const response = await fetch(base + '/api/session', { method: 'POST' }); const cookie = response.headers.get('set-cookie').split(';')[0];
 async function rejected(headers) {
  const socket = new WebSocket(base.replace('http', 'ws') + '/ws', { headers });
  socket.on('error', () => {});
  const code = await new Promise((resolve, reject) => { const timer = setTimeout(() => { socket.terminate(); reject(Error('Upgrade rejection timed out')); }, 2500); socket.on('unexpected-response', (_, res) => { clearTimeout(timer); resolve(res.statusCode); res.resume(); socket.terminate(); }); });
  assert.equal(code, 403);
 }
 await rejected({}); await rejected({ Cookie: cookie, Origin: 'https://untrusted.invalid' });
 const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { Cookie: cookie } }); await new Promise(r => ws.once('open', r));
 await rejected({ Cookie: cookie }); ws.close(); await new Promise(r => ws.once('close', r));
});
test('Worldwide connects across countries without requiring coordinates', async () => {
 const a = await client(), b = await client();
 try {
  a.send('join', { adult: true, pool: { scope: 'world', country: 'IN' } }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'world', country: 'GB' } });
  const [am, bm] = await Promise.all([a.wait('matched'), b.wait('matched')]);
  assert.equal(am.room, bm.room); assert.equal(am.location, 'Worldwide'); assert.equal(am.nearest, false); assert.equal(am.lat, undefined); assert.equal(am.partnerLocation, null); assert.equal(bm.partnerLocation, null);
 } finally { await a.close(); await b.close(); }
});
for (const selected of [pool, { scope: 'region', country: 'IN', region: 'MH' }, { scope: 'country', country: 'IN' }, { scope: 'world' }]) {
 test(`${selected.scope}: nearest mode chooses the closest eligible waiting stranger, not queue order`, async () => {
  // Block these two first, so both can wait simultaneously for a third person.
  const { a, b } = await paired(); const c = await client();
  try {
   a.send('block'); await a.wait('blocked'); await b.wait('partner_left');
   a.send('join', { adult: true, pool: { ...selected, preferNearest: true, lat: 40.7, lon: -74 } }); await a.wait('waiting');
   b.send('join', { adult: true, pool: { ...selected, preferNearest: true, lat: 19.1, lon: 72.9 } }); await b.wait('waiting');
   c.send('join', { adult: true, pool: { ...selected, preferNearest: true, lat: 18.5, lon: 73.9 } });
   const [bm, cm] = await Promise.all([b.wait('matched'), c.wait('matched')]);
   assert.equal(bm.room, cm.room); assert.equal(cm.nearest, true); assert.equal(cm.lat, undefined); assert.equal(cm.lon, undefined); assert.equal(cm.geo, undefined);
   // Mumbai-Pune is over 100 km: City/State/Country/World nearest has no Nearby radius cap.
   assert.equal(a.queue.some(e => e.type === 'matched'), false);
  } finally { await a.close(); await b.close(); await c.close(); }
 });
}
test('nearest validates consent data and never silently switches to random or a broader scope', async () => {
 const a = await client(), b = await client(), c = await client();
 try {
  a.send('join', { adult: true, pool: { scope: 'world', preferNearest: true } }); assert.match((await a.wait('error')).message, /location access/);
  a.send('join', { adult: true, pool: { scope: 'world', preferNearest: true, lat: 91, lon: 0 } }); await a.wait('error');
  a.send('join', { adult: true, pool: { scope: 'world', preferNearest: 'yes', lat: 0, lon: 0 } }); await a.wait('error');
  a.send('join', { adult: true, pool: { scope: 'world', preferNearest: true, lat: 18.5, lon: 73.9 } }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'world', preferNearest: false } }); await b.wait('waiting');
  c.send('join', { adult: true, pool: { ...pool, preferNearest: true, lat: 18.5, lon: 73.9 } }); await c.wait('waiting');
  for (const person of [a,b,c]) assert.equal(person.queue.some(e => e.type === 'matched'), false);
 } finally { await a.close(); await b.close(); await c.close(); }
});
for (const preferNearest of [false, true]) {
 test(`Nearby with nearest ${preferNearest ? 'on' : 'off'} respects radius and uses the selected ordering`, async () => {
  const { a, b } = await paired(); const c = await client();
  try {
   a.send('block'); await a.wait('blocked'); await b.wait('partner_left');
   a.send('join', { adult: true, pool: { scope: 'nearby', preferNearest, lat: 18.9, lon: 74.4 } }); await a.wait('waiting');
   b.send('join', { adult: true, pool: { scope: 'nearby', preferNearest, lat: 18.6, lon: 74 } }); await b.wait('waiting');
   c.send('join', { adult: true, pool: { scope: 'nearby', preferNearest, lat: 18.5, lon: 73.9 } });
   const chosen = preferNearest ? b : a, remaining = preferNearest ? a : b;
   const [cm, chosenMatch] = await Promise.all([c.wait('matched'), chosen.wait('matched')]);
   assert.equal(cm.room, chosenMatch.room); assert.equal(cm.nearest, preferNearest);
   assert.equal(remaining.queue.some(e => e.type === 'matched'), false);
  } finally { await a.close(); await b.close(); await c.close(); }
 });
}
test('matched strangers receive their partner’s selected city and country', async () => {
 const a = await client(), b = await client();
 try {
  a.send('join', { adult: true, pool }); await a.wait('waiting');
  b.send('join', { adult: true, pool });
  const [am,bm] = await Promise.all([a.wait('matched'), b.wait('matched')]);
  for (const event of [am,bm]) assert.deepEqual(event.partnerLocation, { city: 'Pune', country: 'India', label: 'Pune, India', source: 'selected-area' });
 } finally { await a.close(); await b.close(); }
});
test('Worldwide shares each partner’s optional location, not the viewer’s location or coordinates', async () => {
 const a = await client(), b = await client();
 try {
  a.send('join', { adult: true, pool: { scope: 'world' }, displayLocation: { country: 'IN', city: 'Pune', lat: 18.52, lon: 73.85 } }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'world' }, displayLocation: { country: 'GB', city: 'London' } });
  const [am,bm] = await Promise.all([a.wait('matched'), b.wait('matched')]);
  assert.deepEqual(am.partnerLocation, { city: 'London', country: 'United Kingdom', label: 'London, United Kingdom', source: 'shared' });
  assert.deepEqual(bm.partnerLocation, { city: 'Pune', country: 'India', label: 'Pune, India', source: 'shared' });
  assert.equal(am.location, 'Worldwide'); assert.equal(bm.location, 'Worldwide');
 } finally { await a.close(); await b.close(); }
});
test('invalid shared cities are rejected; country-only matches never invent a city', async () => {
 const a = await client(), b = await client();
 try {
  a.send('join', { adult: true, pool: { scope: 'world' }, displayLocation: { city: '<img onerror=alert(1)>', country: 'IN' } }); await a.wait('error');
  a.send('join', { adult: true, pool: { scope: 'world' }, displayLocation: { city: 'Paris', country: 'IN' } }); await a.wait('error');
  a.send('join', { adult: true, pool: { scope: 'country', country: 'IN' } }); await a.wait('waiting');
  b.send('join', { adult: true, pool: { scope: 'country', country: 'IN' } });
  const [am,bm] = await Promise.all([a.wait('matched'), b.wait('matched')]);
  for (const event of [am,bm]) { assert.equal(event.partnerLocation.city, null); assert.equal(event.partnerLocation.country, 'India'); }
 } finally { await a.close(); await b.close(); }
});
