import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createApp } from '../server.js';
let server, base;
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRc8AAAAASUVORK5CYII=', 'base64');
before(async () => { server = createApp(); await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); });
async function person() {
 const response = await fetch(base + '/api/session', { method: 'POST' }); const cookie = response.headers.get('set-cookie').split(';')[0];
 const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { Cookie: cookie } });
 const queue = [], waiters = [];
 ws.on('message', data => { const event = JSON.parse(data), index = waiters.findIndex(w => w.type === event.type); if (index < 0) queue.push(event); else waiters.splice(index, 1)[0].resolve(event); });
 const wait = type => { const index = queue.findIndex(e => e.type === type); if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(`Timed out: ${type}`)), 3000); waiters.push({ type, resolve: e => { clearTimeout(timer); resolve(e); } }); }); };
 await wait('connected');
 return { cookie, wait, send: (type, values = {}) => ws.send(JSON.stringify({ type, ...values })), close: async () => { ws.close(); await new Promise(r => ws.once('close', r)); } };
}
async function pair() { const a = await person(), b = await person(); a.send('join', { adult: true, pool: { scope: 'world' } }); await a.wait('waiting'); b.send('join', { adult: true, pool: { scope: 'world' } }); const am = await a.wait('matched'); await b.wait('matched'); return { a, b, room: am.room }; }
const upload = (user, room, body, name = 'hello.png', viewOnce = false, extra = {}) => fetch(`${base}/api/attachments?${new URLSearchParams({ room, name, viewOnce })}`, { method: 'POST', headers: { Cookie: user.cookie, 'Content-Type': 'application/octet-stream', ...extra }, body });
const preview = (user, path) => fetch(base + path, { headers: { Cookie: user.cookie } });
test('images and text attachments reach both members and have no download route', async () => {
 const { a, b, room } = await pair();
 try {
  const response = await upload(a, room, photo); assert.equal(response.status, 201);
  const sent = await a.wait('attachment'), received = await b.wait('attachment');
  assert.equal(sent.mine, true); assert.equal(received.mine, false); assert.equal(sent.attachment.id, received.attachment.id);
  const path = received.attachment.previewUrl; const image = await preview(b, path);
  assert.equal(image.headers.get('content-type'), 'image/png'); assert.match(image.headers.get('content-disposition'), /^inline/); assert.match(image.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), photo);
  assert.equal((await preview(b, path.replace('/preview', ''))).status, 404);
  assert.equal((await upload(b, room, Buffer.from('<script>hello</script>'), 'notes.txt')).status, 201);
  const textEvent = await a.wait('attachment'); await b.wait('attachment');
  const text = await preview(a, textEvent.attachment.previewUrl); assert.match(text.headers.get('content-type'), /text\/plain/); assert.equal(await text.text(), '<script>hello</script>');
 } finally { await a.close(); await b.close(); }
});
test('view-once images permit exactly one recipient read, notify both, and cannot be opened by the sender', async () => {
 const { a, b, room } = await pair();
 try {
  assert.equal((await upload(a, room, photo, 'once.png', true)).status, 201);
  const sent = await a.wait('attachment'); await b.wait('attachment');
  const path = sent.attachment.previewUrl;
  assert.equal((await preview(a, path)).status, 403);
  const results = await Promise.all([preview(b, path), preview(b, path)]); assert.deepEqual(results.map(r => r.status).sort(), [200,410]);
  assert.equal((await a.wait('attachment_viewed')).id, sent.attachment.id); await b.wait('attachment_viewed');
  assert.equal((await preview(b, path)).status, 410);
 } finally { await a.close(); await b.close(); }
});
test('outsiders and foreign origins cannot upload or read, and files expire when the chat ends', async () => {
 const { a, b, room } = await pair(); const outsider = await person();
 try {
  assert.equal((await upload(outsider, room, photo)).status, 403);
  assert.equal((await upload(a, room, photo, 'photo.png', false, { Origin: 'https://other.invalid' })).status, 403);
  await upload(a, room, photo); const event = await a.wait('attachment'); await b.wait('attachment');
  assert.equal((await preview(outsider, event.attachment.previewUrl)).status, 404);
  assert.equal((await fetch(base + event.attachment.previewUrl)).status, 401);
  a.send('leave'); await b.wait('partner_left');
  assert.equal((await preview(a, event.attachment.previewUrl)).status, 404); assert.equal((await preview(b, event.attachment.previewUrl)).status, 404);
  assert.equal((await upload(a, room, photo)).status, 403);
 } finally { await a.close(); await b.close(); await outsider.close(); }
});
test('server enforces size, encoding, format and view-once image limits', async () => {
 const { a, b, room } = await pair();
 try {
  assert.equal((await upload(a, room, Buffer.from('not a photo'), 'fake.png')).status, 415);
  assert.equal((await upload(a, room, Buffer.from('document'), 'notes.txt', true)).status, 415);
  assert.equal((await upload(a, room, Buffer.from([255, 255]), 'notes.txt')).status, 415);
  assert.equal((await upload(a, room, Buffer.alloc(1024 * 1024 + 1), 'large.txt')).status, 413);
  assert.equal((await upload(a, room, Buffer.alloc(10 * 1024 * 1024 + 1), 'huge.png')).status, 413);
  const image = Buffer.alloc(8 * 1024 * 1024); photo.copy(image);
  assert.equal((await upload(a, room, image, 'a.png')).status, 201);
  assert.equal((await upload(a, room, image, 'b.png')).status, 201);
  assert.equal((await upload(a, room, image, 'c.png')).status, 413);
 } finally { await a.close(); await b.close(); }
});
