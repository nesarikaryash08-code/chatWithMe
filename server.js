import http from 'node:http';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Country, State, City } from 'country-state-city';

export function createApp({ reportDirectory = '.data' } = {}) {
  const sessions = new Map(), waiting = new Set(), rooms = new Map();
  const countries = Country.getAllCountries();
  const states = new Map(), cities = new Map();
  const rate = new Map();
  const emit = (s, type, data = {}) => { if (s?.ws?.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type, ...data })); };
  function rateLimit(key, max, period) {
    const now = Date.now(); let entry = rate.get(key);
    if (!entry || now > entry.until) { entry = { count: 0, until: now + period }; rate.set(key, entry); }
    return ++entry.count <= max;
  }
  const getStates = country => { if (!states.has(country)) states.set(country, State.getStatesOfCountry(country)); return states.get(country); };
  const getCities = (country, state) => { const key = `${country}:${state}`; if (!cities.has(key)) cities.set(key, City.getCitiesOfState(country, state)); return cities.get(key); };
  const cookieId = req => /(?:^|;\s*)chat_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const session = req => sessions.get(cookieId(req));
  const json = (res, status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(data)); };
  function end(s, reason = 'left') {
    waiting.delete(s.id); s.pool = null;
    if (s.room) {
      const room = rooms.get(s.room); rooms.delete(s.room); s.room = null;
      if (room) for (const id of room.members) { const member = sessions.get(id); if (member) { member.room = null; if (id !== s.id) emit(member, 'partner_left', { reason }); } }
    }
  }
  const distance = (a, b) => {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(a.lat - b.lat), dLon = rad(a.lon - b.lon);
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2)));
  };
  function match(s) {
    let candidate, closest = Infinity;
    for (const id of waiting) {
      const other = sessions.get(id);
      if (!other || other.id === s.id || !other.pool || other.ws?.readyState !== WebSocket.OPEN || other.blocked.has(s.id) || s.blocked.has(id) || other.lastPartner === s.id || s.lastPartner === id) continue;
      if (other.pool.key !== s.pool.key) continue;
      const needsDistance = s.pool.preferNearest || s.pool.scope === 'nearby';
      const d = needsDistance ? distance(s.pool.geo, other.pool.geo) : 0;
      const limit = s.pool.scope === 'nearby' ? 100 : Infinity;
      const score = s.pool.preferNearest ? d : 0;
      if (d <= limit && score < closest) { candidate = other; closest = score; }
    }
    if (!candidate) { waiting.add(s.id); emit(s, 'waiting'); return; }
    waiting.delete(candidate.id); waiting.delete(s.id);
    const id = randomUUID(), room = { id, members: [s.id, candidate.id], messages: [] };
    rooms.set(id, room);
    for (const [a, b] of [[s, candidate], [candidate, s]]) {
      a.room = id; a.lastPartner = b.id;
      emit(a, 'matched', { room: id, location: a.pool.scope === 'nearby' ? 'Within 100 km' : a.pool.label, nearest: a.pool.preferNearest, partnerLocation: b.displayLocation });
    }
  }
  function validatePool(p) {
    if (!p || !['city', 'region', 'country', 'world', 'nearby'].includes(p.scope)) throw Error('Choose a matching area.');
    if (p.preferNearest !== undefined && typeof p.preferNearest !== 'boolean') throw Error('Invalid nearest preference.');
    const preferNearest = p.preferNearest ?? (p.scope === 'nearby');
    let geo;
    if (preferNearest || p.scope === 'nearby') {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) throw Error('Allow location access for nearest or nearby matching.');
      geo = { lat: Math.round(p.lat * 10) / 10, lon: Math.round(p.lon * 10) / 10 };
    }
    // Location-sharing participants use their own queue; random mode never needs coordinates.
    const makePool = (key, label) => ({ scope: p.scope, key: `${key}:${preferNearest ? 'nearest' : 'random'}`, label, preferNearest, ...(geo ? { geo } : {}) });
    if (p.scope === 'nearby') return makePool('nearby', 'Nearby');
    if (p.scope === 'world') return makePool('world', 'Worldwide');
    const country = countries.find(c => c.isoCode === p.country);
    if (!country) throw Error('Select a country.');
    if (p.scope === 'country') return makePool(`country:${country.isoCode}`, country.name);
    const state = getStates(p.country).find(s => s.isoCode === p.region);
    if (!state) throw Error('Select a state or region.');
    if (p.scope === 'region') return makePool(`region:${p.country}:${p.region}`, state.name);
    const city = getCities(p.country, p.region).find(c => c.name === p.city);
    if (!city) throw Error('Select a city.');
    return makePool(`city:${p.country}:${p.region}:${city.name}`, city.name);
  }
  function displayLocation(value, pool) {
    // Display places are chosen by participants, never claimed as verified GPS locations.
    if (value !== undefined && value !== null) {
      if (!value || typeof value !== 'object' || typeof value.country !== 'string' || typeof value.city !== 'string' || value.city.length > 150) throw Error('Choose a valid city and country to share.');
      const country = countries.find(c => c.isoCode === value.country);
      const city = country && City.getCitiesOfCountry(country.isoCode).find(c => c.name === value.city);
      if (!city) throw Error('Choose a valid city and country to share.');
      return { city: city.name, country: country.name, label: `${city.name}, ${country.name}`, source: 'shared' };
    }
    if (['city', 'region', 'country'].includes(pool.scope)) {
      const country = countries.find(c => c.isoCode === pool.country);
      if (pool.scope === 'city') return { city: pool.city, country: country.name, label: `${pool.city}, ${country.name}`, source: 'selected-area' };
      return { city: null, country: country.name, label: country.name, source: 'selected-area' };
    }
    return null;
  }
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/session' && req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return json(res, 403, { error: 'Invalid origin' });
        let s = session(req);
        if (!s) {
          if (!rateLimit(`session:${req.socket.remoteAddress}`, 60, 60_000)) return json(res, 429, { error: 'Too many sessions. Try again in a minute.' });
          const id = randomBytes(24).toString('hex');
          s = { id, blocked: new Set(), room: null, ws: null, touched: Date.now() }; sessions.set(id, s);
        }
        return json(res, 200, { ok: true }, { 'Set-Cookie': `chat_session=${s.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=21600${process.env.SECURE_COOKIE === 'true' ? '; Secure' : ''}` });
      }
      if (url.pathname === '/api/locations') {
        const country = url.searchParams.get('country'), region = url.searchParams.get('region');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (country && !countries.some(c => c.isoCode === country)) return json(res, 400, { error: 'Unknown country' });
        if (region && (!country || !getStates(country).some(s => s.isoCode === region))) return json(res, 400, { error: 'Unknown region' });
        const list = !country ? countries.map(c => ({ id: c.isoCode, name: c.name, flag: c.flag })) : !region ? getStates(country).map(s => ({ id: s.isoCode, name: s.name })) : getCities(country, region).map(c => ({ id: c.name, name: c.name }));
        return json(res, 200, list.filter(v => v.name.toLowerCase().includes(q)));
      }
      if (url.pathname === '/api/stats') return json(res, 200, { online: [...sessions.values()].filter(s => s.ws?.readyState === WebSocket.OPEN).length });
      if (url.pathname === '/health') return json(res, 200, { ok: true });
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
      const files = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg' };
      const file = files[url.pathname]; if (!file) return json(res, 404, { error: 'Not found' });
      const body = await readFile(new URL(`./public/${file}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); res.end(body);
    } catch { json(res, 500, { error: 'Something went wrong. Please try again.' }); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (req, socket, head) => {
    const s = session(req);
    const validOrigin = !req.headers.origin || ['http', 'https'].some(protocol => req.headers.origin === `${protocol}://${req.headers.host}`);
    if (req.url !== '/ws' || !s || !validOrigin || s.ws?.readyState === WebSocket.OPEN) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      s.ws = ws; s.touched = Date.now(); ws.alive = true; emit(s, 'connected');
      ws.on('pong', () => { ws.alive = true; s.touched = Date.now(); });
      ws.on('message', async raw => {
        try {
          if (!rateLimit(`events:${s.id}`, 100, 60_000)) throw Error('Slow down a little. Please try again in a minute.');
          const event = JSON.parse(raw); s.touched = Date.now();
          if (event.type === 'join') {
            if (event.adult !== true) throw Error('Confirm that you are 18 or older.');
            if (!rateLimit(`join:${s.id}`, 20, 60_000)) throw Error('Please wait a minute before searching again.');
            const pool = validatePool(event.pool);
            const place = displayLocation(event.displayLocation, event.pool);
            end(s); s.pool = pool; s.displayLocation = place; match(s);
          } else if (event.type === 'leave') { end(s); emit(s, 'left'); }
          else if (event.type === 'message') {
            const room = rooms.get(s.room);
            if (!room || event.room !== room.id) throw Error('This conversation has ended.');
            const content = typeof event.text === 'string' ? event.text.trim() : '';
            if (!content || content.length > 1000) throw Error('Messages must be between 1 and 1,000 characters.');
            if (!rateLimit(`message:${s.id}`, 30, 10_000)) throw Error('You are sending messages too quickly.');
            if (typeof event.id !== 'string' || event.id.length > 80) throw Error('Invalid message.');
            if (room.messages.some(m => m.id === event.id && m.sender === s.id)) return;
            room.messages.push({ id: event.id, sender: s.id, text: content, time: Date.now() }); room.messages = room.messages.slice(-50);
            for (const id of room.members) emit(sessions.get(id), 'message', { id: event.id, text: content, mine: id === s.id });
          } else if (event.type === 'typing') {
            const room = rooms.get(s.room); if (room && rateLimit(`typing:${s.id}`, 4, 1000)) for (const id of room.members) if (id !== s.id) emit(sessions.get(id), 'typing');
          } else if (event.type === 'block' || event.type === 'report') {
            const room = rooms.get(s.room); if (!room) throw Error('This conversation has ended.');
            const other = room.members.find(id => id !== s.id);
            if (event.type === 'report') {
              if (!['Harassment or hate', 'Sexual content', 'Spam or scam', 'Underage user', 'Something else'].includes(event.reason)) throw Error('Choose a report reason.');
              try {
              await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
              await appendFile(`${reportDirectory}/reports.jsonl`, JSON.stringify({ id: randomUUID(), reporter: s.id, reported: other, reason: event.reason, time: Date.now(), messages: room.messages }) + '\n', { mode: 0o600 });
              } catch { throw Error('Your report could not be saved. Please try again or use Block.'); }
            }
            s.blocked.add(other); end(s, 'left'); emit(s, event.type === 'report' ? 'reported' : 'blocked');
          } else throw Error('Unknown action.');
        } catch (error) { emit(s, 'error', { message: error instanceof SyntaxError ? 'Invalid request.' : error.message }); }
      });
      ws.on('close', () => { if (s.ws === ws) { end(s, 'disconnected'); s.ws = null; s.touched = Date.now(); } });
      ws.on('error', () => ws.close());
    });
  });
  const timer = setInterval(() => {
    for (const s of sessions.values()) {
      if (s.ws?.readyState === WebSocket.OPEN) { if (!s.ws.alive) s.ws.terminate(); else { s.ws.alive = false; s.ws.ping(); } }
      else if (Date.now() - s.touched > 6 * 3600_000) { end(s); sessions.delete(s.id); }
    }
    for (const [key, value] of rate) if (Date.now() > value.until) rate.delete(key);
  }, 30_000); timer.unref();
  server.on('close', () => { clearInterval(timer); for (const client of wss.clients) client.terminate(); wss.close(); });
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createApp(); const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log(`ChatWithMe listening on port ${port}`));
}
