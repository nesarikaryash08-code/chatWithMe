import { randomUUID } from 'node:crypto';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ROOM_LIMIT = 20 * 1024 * 1024;
const SERVER_LIMIT = 100 * 1024 * 1024;
export function attachmentStore({ session, sessionById, rooms, emit, rateLimit, json }) {
  const files = new Map(), uploading = new Set(); let reserved = 0;
  const fail = (req, res, status, message) => { req.resume(); json(res, status, { error: message }); };
  const imageType = data => {
    if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
    if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
    if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))) return 'image/gif';
    if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
    return null;
  };
  function clearRoom(room) {
    room.closed = true;
    for (const request of room.uploads || []) request.destroy();
    for (const id of room.attachments || []) files.delete(id);
    reserved -= room.fileBytes || 0; room.fileBytes = 0;
  }
  async function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/attachments')) return false;
    res.setHeader('Cache-Control', 'no-store, private');
    const user = session(req);
    if (!user) { fail(req, res, 401, 'Your chat has expired. Please refresh the page.'); return true; }
    if (url.pathname === '/api/attachments' && req.method === 'POST') {
      if (!['http', 'https'].some(p => req.headers.origin === `${p}://${req.headers.host}`) && req.headers.origin) { fail(req, res, 403, 'Please open the chat from this website.'); return true; }
      const room = rooms.get(user.room);
      if (!room || url.searchParams.get('room') !== room.id || !room.members.includes(user.id)) { fail(req, res, 403, 'Start a chat before sending a file.'); return true; }
      const length = req.headers['content-length']; const size = Number(length);
      if (!length || !Number.isSafeInteger(size) || size <= 0) { fail(req, res, 400, 'Choose a file that is not empty.'); return true; }
      if (size > MAX_FILE_SIZE) { fail(req, res, 413, 'Choose a file up to 10 MB.'); return true; }
      const name = (url.searchParams.get('name') || 'attachment').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 160) || 'attachment';
      const onceValue = url.searchParams.get('viewOnce');
      if (onceValue && !['true','false'].includes(onceValue)) { fail(req, res, 400, 'Check the View once option and try again.'); return true; }
      const viewOnce = onceValue === 'true';
      if (uploading.has(user.id)) { fail(req, res, 409, 'Please wait for the current file to finish uploading.'); return true; }
      if (!rateLimit(`upload:${user.id}`, 10, 60_000)) { fail(req, res, 429, 'Please wait a minute before sending more files.'); return true; }
      if ((room.fileBytes || 0) + size > ROOM_LIMIT || (room.attachments?.size || 0) >= 50) { fail(req, res, 413, 'This chat has reached its limit of 20 MB or 50 files.'); return true; }
      if (reserved + size > SERVER_LIMIT) { fail(req, res, 503, 'File sharing is busy. Please try again in a few seconds.'); return true; }
      room.uploads ??= new Set(); room.attachments ??= new Set(); room.fileBytes = (room.fileBytes || 0) + size;
      room.uploads.add(req); uploading.add(user.id); reserved += size; let saved = false;
      req.setTimeout(30_000, () => req.destroy());
      try {
        let received = 0; const chunks = [];
        for await (const chunk of req) { received += chunk.length; if (received > size || received > MAX_FILE_SIZE) throw Error('File is too large.'); chunks.push(chunk); }
        if (received !== size) throw Error('The file was not fully uploaded. Please try again.');
        if (room.closed || user.room !== room.id || rooms.get(room.id) !== room) throw Error('This chat has ended.');
        const data = Buffer.concat(chunks); const imageMime = imageType(data);
        const textFile = /\.(txt|md|csv|json|log)$/i.test(name);
        if (!imageMime && !textFile) { json(res, 415, { error: 'Choose a PNG, JPEG, GIF, WebP, TXT, Markdown, CSV, JSON, or log file.' }); return true; }
        if (textFile && !imageMime) {
          if (size > 1024 * 1024) { json(res, 413, { error: 'Choose a text file up to 1 MB.' }); return true; }
          try { new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { json(res, 415, { error: 'Save the text file as UTF-8 and try again.' }); return true; }
        }
        if (viewOnce && !imageMime) { json(res, 415, { error: 'View once works only with PNG, JPEG, GIF and WebP photos.' }); return true; }
        const id = randomUUID();
        const attachment = { id, name, size, mime: imageMime || 'text/plain; charset=utf-8', image: !!imageMime, viewOnce, previewUrl: `/api/attachments/${id}/preview` };
        files.set(id, { ...attachment, data, room: room.id, sender: user.id, viewed: false }); room.attachments.add(id); saved = true;
        room.messages.push({ id, sender: user.id, attachment, time: Date.now() }); room.messages = room.messages.slice(-50);
        for (const member of room.members) emit(sessionById(member), 'attachment', { attachment, mine: member === user.id });
        json(res, 201, { ok: true });
      } catch {
        if (!res.destroyed && !res.writableEnded) json(res, 409, { error: 'Could not send the file. Make sure the chat is still open and try again.' });
      } finally {
        req.setTimeout(0); room.uploads.delete(req); uploading.delete(user.id);
        if (!saved && !room.closed) { reserved -= size; room.fileBytes -= size; }
      }
      return true;
    }
    const route = /^\/api\/attachments\/([a-f0-9-]{36})(\/preview)?$/.exec(url.pathname);
    if (!route || !route[2] || req.method !== 'GET') { json(res, 404, { error: 'File not found.' }); return true; }
    const file = files.get(route[1]); const room = file && rooms.get(file.room);
    if (!room || user.room !== room.id || !room.members.includes(user.id)) { json(res, 404, { error: 'This file is no longer available. The chat may have ended.' }); return true; }
    if (file.viewOnce && file.sender === user.id) { json(res, 403, { error: 'Only your friend can open this photo, and only once.' }); return true; }
    if (file.viewed || !file.data) { json(res, 410, { error: 'This photo has already been opened. It cannot be opened again.' }); return true; }
    const data = file.data;
    if (file.viewOnce) {
      file.viewed = true; file.data = null; reserved -= file.size; room.fileBytes -= file.size;
      for (const member of room.members) emit(sessionById(member), 'attachment_viewed', { id: file.id });
    }
    const encodedName = encodeURIComponent(file.name).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16)}`);
    res.writeHead(200, {
      'Content-Type': file.mime,
      'Content-Length': data.length,
      'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
      'Cross-Origin-Resource-Policy': 'same-origin'
    });
    res.end(data); return true;
  }
  return { handle, clearRoom };
}
