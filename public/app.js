const paths = {
 paperclip:'<path d="m21 11-9 9a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7L9 17a2 2 0 0 1-2.8-2.8l9-9"/>',
 chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 shield:'<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
 buildings:'<path d="M3 21V7h8v14M11 21V3h10v18M1 21h22M6 10h2M6 14h2M6 18h2M15 7h2M15 11h2M15 15h2M15 19h2"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/>',
 locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 shuffle:'<path d="m17 3 4 4-4 4M17 13l4 4-4 4M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 4-2 6-5M14 9c1-1 3-2 4-2h3"/>',
 'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>', 'arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
 'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 incognito:'<path d="M3 10h18M6 10l2-7h8l2 7M10 16h4"/><circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/>',
 flag:'<path d="M4 22V3c5-4 10 4 16 0v12c-6 4-11-4-16 0"/>',
 ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'
};
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[el.dataset.icon] || paths.chat}</svg>`; }); }
icons();
const $ = id => document.getElementById(id);
let scope = 'city', status = 'idle', ws, room, geo, countryList = [], cities = [], connected = false, reconnectTimer, toastTimer, typingTimer;
let pendingFile = null, uploadRequest = null;
let regionLoad = 0, cityLoad = 0, lastTypingSent = 0, searchAttempt = 0;
const nearestByScope = { city: false, region: false, country: false, world: false, nearby: true };
const originalEmpty = $('empty-state').innerHTML;
const dialog = $('info-dialog');
const pages = {
 "how": [
  "HOW TO USE",
  "Start a chat in three steps.",
  "<ol><li><strong>Choose a place.</strong> Select City, State, Country, Worldwide or Nearby. The place you choose is where you want to find someone. It does not confirm where you live.</li><li><strong>Click Find someone.</strong> We will connect you with someone waiting in the same area and matching option. If no one is available, you can choose a larger area.</li><li><strong>Say hello.</strong> Send messages, photos or text files. You can skip or leave at any time. No signup or profile is needed.</li></ol><p>Worldwide includes all countries. Nearby finds people within 100 km. Turn on Nearest first to find the nearest person waiting with this option on. It needs location access. Your exact location is not shown.</p><p>In City mode, your friend will see the city and country you selected. For other options, you can choose to show your city and country. You can match only when someone else is waiting.</p>"
 ],
 "safety": [
  "STAY SAFE",
  "A few things to remember.",
  "<p>You must be 18 or above. The age checkbox is your confirmation. We do not verify your age.</p><ul><li>Do not share your address, phone number, bank details or other private information.</li><li>Do not send money or open unknown links. Open a file only if you trust it.</li><li>You can leave a chat at any time.</li><li>Block stops you from matching with that friend again during your current visit. Report saves recent messages and file details for review.</li></ul><p>No one is currently monitoring chats. There is no automatic checking system. If you are in immediate danger, contact local emergency services.</p>"
 ],
 "privacy": [
  "YOUR PRIVACY",
  "How your information is used.",
  "<p>No signup or permanent profile is needed. Your chat history is not shown to other people. A small temporary browser cookie keeps your chat connected and remembers blocks. It expires after six hours without activity.</p><p>Normal messages and files stay on the server only while the chat is open. They are removed when the chat ends. A view-once photo is removed from the server after it is opened once. A person may still save what they see using their browser or device.</p><p>If a chat is reported, up to 50 recent messages, file names, file sizes and temporary chat IDs are saved for review. The files themselves are not saved with the report. Report records stay until they are deleted by the person managing reports.</p><p>In City mode, your friend sees the city and country you select. State and Country modes show your selected country unless you also choose to show a city. Worldwide and Nearby show no city or country unless you choose to share them. We do not check if you live in the place you select.</p><p>Nearest first and Nearby use an approximate location, rounded to about 10 km. Your friend never sees your exact location. Other matching options do not ask for location access.</p><p>Your internet address is used to limit misuse. The hosting service may also keep connection records. Chats are not end-to-end encrypted, so the server can read them. A public website should use HTTPS to protect the connection.</p>"
 ],
 "guidelines": [
  "CHAT RULES",
  "Be friendly and respectful.",
  "<ul><li>You must be 18 or above.</li><li>Do not abuse, threaten or harass anyone. Do not spread hate or share sexual content.</li><li>Do not send spam, cheat people or pretend to be someone else. Do not share another person’s private information.</li><li>Do not pressure or take advantage of anyone. Respect their choice to leave.</li></ul><p>Use Block or Report if something is wrong. You do not need to share personal details to start a chat.</p>"
 ]
};
function showDialog(title, html, kicker = 'CHATWITHME') {
 $('dialog-content').innerHTML = `<span class="dialog-kicker">${kicker}</span><h2>${title}</h2>${html}`;
 if (!dialog.open) dialog.showModal(); icons(dialog);
}
document.addEventListener('click', e => { const button = e.target.closest('[data-open]'); if (button) { const [kicker, title, content] = pages[button.dataset.open]; showDialog(title, content, kicker); } });
$('close-dialog').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
function error(text) { $('form-error').textContent = text; }
function send(type, data = {}) { if (!ws || ws.readyState !== WebSocket.OPEN) { toast('Connection lost. Trying again…'); return false; } ws.send(JSON.stringify({ type, ...data })); return true; }
function setState(next) {
 status = next;
 const active = next === 'chat', busy = next === 'searching' || next === 'locating' || active;
 $('find').disabled = busy || !connected;
 $('find').children[1].textContent = next === 'locating' ? 'Getting your location…' : next === 'searching' ? 'Finding someone…' : active ? 'Chat in progress' : 'Find someone';
 document.querySelectorAll('.scope, #country, #region, #city, #adult, #prefer-nearest, #share-city').forEach(el => el.disabled = busy);
 $('chat-toolbar').hidden = !active;
 $('icebreakers').hidden = !active;
 $('partner-place').hidden = !active;
 $('search-actions').hidden = next !== 'searching' && next !== 'locating';
 $('broaden').hidden = next === 'locating' || ['country', 'nearby', 'world'].includes(scope);
 $('attach').disabled = !active || !!uploadRequest;
 $('attachment-input').disabled = !active;
 if (!active) { clearAttachment(); if ($('photo-viewer')) dialog.close(); document.querySelectorAll('.open-attachment').forEach(button => { button.disabled = true; button.textContent = 'Chat ended'; }); }
 $('message').disabled = !active;
 $('send').disabled = !active || !$('message').value.trim();
 $('message').placeholder = active ? 'Type your message…' : 'Start a chat to send a message…';
 $('typing').textContent = '';
 if (!active) room = null;
}
function empty(title, text, searching = false) {
 $('conversation').className = 'conversation';
 const container = document.createElement('div'); container.className = `empty-state${searching ? ' searching' : ''}`; container.innerHTML = originalEmpty;
 if (title) { container.querySelector('.state-copy h2').textContent = title; container.querySelector('.state-copy p').textContent = text; container.querySelector('.small').textContent = searching ? 'PLEASE WAIT WHILE WE FIND SOMEONE' : 'START A NEW CHAT WHEN YOU ARE READY'; }
 $('conversation').replaceChildren(container); icons(container);
}
function selectScope(value) {
 scope = value; geo = null; error('');
 document.querySelectorAll('.scope').forEach(b => { b.classList.toggle('active', b.dataset.scope === value); b.setAttribute('aria-pressed', String(b.dataset.scope === value)); });
 updateLocationFields();
 $('prefer-nearest').checked = nearestByScope[value];
 updateNearestHelp();
 if (value !== 'city') $('city').setCustomValidity('');
}
document.querySelectorAll('.scope').forEach(b => { b.onclick = () => selectScope(b.dataset.scope); });
function updateLocationFields() {
 const sharing = $('share-city').checked && scope !== 'city';
 const showCountry = sharing || ['city', 'region', 'country'].includes(scope);
 const showRegion = sharing || ['city', 'region'].includes(scope);
 const showCity = sharing || scope === 'city';
 $('share-city-option').hidden = scope === 'city';
 $('location-fields').hidden = !showCountry;
 $('region-field').hidden = !showRegion; $('city-field').hidden = !showCity;
 $('country').required = showCountry; $('region').required = showRegion; $('city').required = showCity;
 $('nearby-info').hidden = scope !== 'nearby';
 if (!showCity) $('city').setCustomValidity('');
}
$('share-city').onchange = () => { updateLocationFields(); updateNearestHelp(); };
function updateNearestHelp() {
 const nearest = $('prefer-nearest').checked;
 $('nearest-help').textContent = nearest
  ? `On: find the nearest person waiting ${scope === 'world' ? 'anywhere in the world' : scope === 'nearby' ? 'within 100 km' : 'in the area you selected'}. Allow location access to use this.`
  : scope === 'nearby' ? 'Off: find anyone waiting within 100 km. This still needs location access.' : 'Off: find anyone waiting in the area you selected.';
 $('location-note').innerHTML = nearest || scope === 'nearby'
  ? `Your exact location is not shown.<br>Both people must have Nearest first ${nearest ? 'on' : 'off'} to match.`
  : scope === 'world' ? 'Chat with people from any country.<br>No location access needed.' : 'Only the area you select is shown.<br>Your exact location is not shown.';
 if (scope === 'city' || $('share-city').checked) $('location-note').innerHTML += '<br>Your friend will see the city and country you selected.';
}
$('prefer-nearest').onchange = () => { nearestByScope[scope] = $('prefer-nearest').checked; geo = null; error(''); updateNearestHelp(); };

async function locations(params = {}) { const response = await fetch('/api/locations?' + new URLSearchParams(params)); if (!response.ok) throw Error('Could not load the places. Please refresh the page.'); return response.json(); }
function options(el, list, preferred, placeholder) {
 el.replaceChildren(); if (!list.length) el.add(new Option(placeholder, ''));
 else for (const item of list) el.add(new Option(`${item.flag ? item.flag + '  ' : ''}${item.name}`, item.id));
 if (list.some(x => x.id === preferred)) el.value = preferred;
}
async function loadCities(preferred = '') {
 const version = ++cityLoad; $('city').value = ''; $('city').placeholder = 'Loading cities…'; $('cities').replaceChildren();
 const list = await locations({ country: $('country').value, region: $('region').value });
 if (version !== cityLoad) return;
 cities = list; $('cities').replaceChildren(...list.map(c => new Option(c.name, c.id)));
 $('city').value = list.some(c => c.id === preferred) ? preferred : '';
 $('city').placeholder = list.length ? 'Search for a city' : 'No cities found. Choose State or Country.';
}
async function loadRegions(preferred = '', city = '') {
 const version = ++regionLoad; ++cityLoad;
 $('region').replaceChildren(new Option('Loading regions…', '')); $('city').value = ''; $('cities').replaceChildren();
 const list = await locations({ country: $('country').value }); if (version !== regionLoad) return;
 options($('region'), list, preferred, 'No states found. Choose Country.');
 if (list.length) await loadCities(city); else { cities = []; $('city').placeholder = 'Choose Country to chat in this place.'; }
}
$('country').onchange = () => loadRegions().catch(e => error(e.message));
$('region').onchange = () => loadCities().catch(e => error(e.message));
$('city').oninput = () => $('city').setCustomValidity('');
async function join() {
 error('');
 const attempt = ++searchAttempt;
 if (!connected) return toast('Still connecting. Please try again in a few seconds.');
 if (!$('adult').checked) return error('Confirm that you are 18 or above to continue.');
 let pool = { scope, preferNearest: $('prefer-nearest').checked, country: $('country').value, region: $('region').value, city: $('city').value.trim() };
 if ((scope === 'city' || $('share-city').checked) && !cities.some(c => c.id === pool.city)) { $('city').setCustomValidity('Select a city from the list.'); $('city').reportValidity(); return; }
 if (scope === 'nearby' || pool.preferNearest) {
   if (!navigator.geolocation) return error('This browser cannot get your location. Turn off Nearest first and choose City, State, Country or Worldwide.');
   setState('locating');
   empty('Getting your location…', 'Allow location access in your browser. Or cancel and choose another option.');
   try {
     geo = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }));
     if (attempt !== searchAttempt || !connected || status !== 'locating') return;
     pool = { ...pool, ...geo };
   } catch {
     if (attempt !== searchAttempt) return;
     setState('idle'); empty('Could not get your location.', 'Allow location access and try again. Or turn off Nearest first and choose City, State, Country or Worldwide.');
     return error('Location unavailable. Allow location access, or turn off Nearest first and choose another area.');
   }
 }
 const sharedPlace = $('share-city').checked && scope !== 'city' ? { country: pool.country, city: pool.city } : undefined;
 if (send('join', { adult: true, pool, displayLocation: sharedPlace })) { setState('searching'); empty('Finding someone to chat…', pool.preferNearest ? 'Looking for the nearest person waiting with Nearest first on in your selected area.' : scope === 'world' ? 'Waiting for someone from any country.' : 'We will connect you when someone in your selected area is ready.', true); $('chat-title').textContent = 'Finding someone'; $('chat-subtitle').textContent = `${scope === 'world' ? 'Worldwide' : 'Your selected area'} · ${pool.preferNearest ? 'Nearest first' : 'Anyone waiting'}`; }
}
$('match-form').onsubmit = e => { e.preventDefault(); join(); };
$('cancel').onclick = () => { ++searchAttempt; if (send('leave')) { setState('idle'); empty(); $('chat-title').textContent = 'Your chat starts here'; $('chat-subtitle').textContent = 'Meet someone new and start talking.'; } };
$('broaden').onclick = async () => { send('leave'); setState('idle'); const keepNearest = $('prefer-nearest').checked; nearestByScope.country = keepNearest; selectScope('country'); await join(); };
$('message').oninput = () => { $('send').disabled = status !== 'chat' || !$('message').value.trim(); if (status === 'chat' && Date.now() - lastTypingSent > 1200) { send('typing'); lastTypingSent = Date.now(); } };
document.querySelectorAll('[data-opener]').forEach(button => { button.onclick = () => { if (status !== 'chat') return; $('message').value = button.dataset.opener; $('send').disabled = false; $('message').focus(); }; });
$('message-form').onsubmit = e => { e.preventDefault(); const text = $('message').value.trim(); if (text && status === 'chat' && send('message', { text, room, id: crypto.randomUUID() })) { $('message').value = ''; $('send').disabled = true; } };
$('next').onclick = async () => { send('leave'); setState('idle'); await join(); };
$('leave').onclick = () => { send('leave'); setState('idle'); empty('Your chat has ended.', 'Click Find someone when you want to start another chat.'); $('chat-title').textContent = 'Chat ended'; $('chat-subtitle').textContent = 'Your chat has been cleared.'; };
$('block').onclick = () => {
 showDialog('Block this friend?', '<p>This will end the chat. You will not match with this friend again during your current visit.</p><div class="dialog-actions"><button class="secondary" id="keep-chatting">Keep chatting</button><button class="primary" id="confirm-block">Block friend</button></div>');
 $('keep-chatting').onclick = () => dialog.close(); $('confirm-block').onclick = () => { if (send('block')) dialog.close(); };
};
$('report').onclick = () => {
 showDialog('Tell us what happened.', '<p>Your report will include the last 50 messages and any file details for review. File contents are not saved with the report. This will also block this friend and end the chat.</p><form id="report-form"><label class="dialog-label" for="report-reason">Reason for reporting</label><select id="report-reason" required><option value="">Choose a reason</option><option value="Harassment or hate">Abuse or hate</option><option>Sexual content</option><option>Spam or scam</option><option value="Underage user">Person below 18</option><option>Something else</option></select><button class="primary" id="report-submit" type="submit">Send report and end chat</button></form>');
 $('report-form').onsubmit = e => { e.preventDefault(); if (send('report', { reason: $('report-reason').value })) { $('report-submit').disabled = true; $('report-submit').textContent = 'Sending report…'; } };
};
function systemMessage(text) { const el = document.createElement('p'); el.className = 'system-message'; el.textContent = text; $('conversation').append(el); }
function appendMessage(event) {
 const row = document.createElement('div'); row.className = 'message-row' + (event.mine ? ' mine' : '');
 const label = document.createElement('span'); label.className = 'message-label'; label.textContent = event.mine ? 'You' : 'Friend';
 const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = event.text; row.append(label, bubble); $('conversation').append(row); $('conversation').scrollTop = $('conversation').scrollHeight; $('typing').textContent = '';
}
async function stats() { try { const res = await fetch('/api/stats'); if (res.ok) { const data = await res.json(); $('online-count').textContent = `${data.online} ${data.online === 1 ? 'person' : 'people'} online`; } } catch { $('online-count').textContent = 'Offline'; } }
async function connect() {
 try {
  const response = await fetch('/api/session', { method: 'POST' }); if (!response.ok) throw Error('Could not connect. Please try again in a minute.');
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  ws.onmessage = ({ data }) => {
   const event = JSON.parse(data);
   if (event.type === 'connected') { connected = true; setState('idle'); error(''); stats(); }
   else if (event.type === 'waiting') { setState('searching'); }
   else if (event.type === 'matched') {
    setState('chat'); room = event.room; $('conversation').replaceChildren(); $('conversation').classList.add('messages');
    systemMessage(event.location === 'Worldwide' ? 'You are connected with a friend through Worldwide. Say hello!' : `You are connected with a friend in ${event.location}. Say hello!`);
    const place = event.partnerLocation;
    $('partner-location').textContent = place?.city ? `${place.city}, ${place.country}` : place?.country ? `${place.country} · City not shared` : 'City & country not shared';
    $('location-source').textContent = place?.source === 'shared' ? 'Shared location' : 'Selected area';
    $('location-source').hidden = !place;
    $('partner-place').title = 'Your friend selected this location. We have not checked if they live there.';
    $('chat-title').textContent = 'Friend'; $('chat-subtitle').textContent = `${event.location} · ${event.nearest ? 'Nearest first' : 'Connected now'}`;
    if (innerWidth > 700) $('message').focus(); else $('chat-title').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
   } else if (event.type === 'message') appendMessage(event);
   else if (event.type === 'attachment') appendAttachment(event);
   else if (event.type === 'attachment_viewed') { const item = document.getElementById(`attachment-${event.id}`); if (item) { const button = item.querySelector('button'); if (button) { button.disabled = true; button.textContent = 'Opened'; } } }
   else if (event.type === 'typing') { $('typing').textContent = 'Friend is typing…'; clearTimeout(typingTimer); typingTimer = setTimeout(() => $('typing').textContent = '', 1800); }
   else if (event.type === 'partner_left') { setState('idle'); $('message').value = ''; systemMessage('Friend has left. Click Find someone to start a new chat.'); $('chat-title').textContent = 'Chat ended'; $('chat-subtitle').textContent = 'You can find someone else to chat with.'; }
   else if (event.type === 'blocked' || event.type === 'reported') { setState('idle'); dialog.close(); empty('You are in control.', event.type === 'reported' ? 'Report sent. This friend is blocked for your current visit.' : 'This friend is blocked for your current visit.'); $('chat-title').textContent = 'Chat ended'; $('chat-subtitle').textContent = 'You can start a new chat when you want.'; toast(event.type === 'reported' ? 'Report sent for review.' : 'Friend blocked.'); }
   else if (event.type === 'error') { error(event.message); toast(event.message); if (status === 'searching') { send('leave'); setState('idle'); empty('Please try again.', event.message); } if ($('report-submit')) { $('report-submit').disabled = false; $('report-submit').textContent = 'Send report and end chat'; } }
  };
  ws.onclose = () => { ++searchAttempt; connected = false; const wasActive = status !== 'idle'; setState('idle'); $('find').disabled = true; $('chat-title').textContent = 'Connection lost'; $('chat-subtitle').textContent = 'Trying to connect again…'; if (wasActive) empty('Connection lost.', 'This chat has ended. Start a new search when you are back online.'); error('Connection lost. Trying again… If this continues, close other tabs using this website.'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 4000); };
  ws.onerror = () => {};
 } catch (e) { error(e.message); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 5000); }
}
selectScope('city');
setState('idle');
Promise.all([locations().then(async list => { countryList = list; options($('country'), list, 'IN', 'Select a country'); await loadRegions('MH', 'Pune'); }), connect()]).catch(e => error(e.message));
setInterval(stats, 15000);

function fileSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function clearAttachment() {
 const xhr = uploadRequest; uploadRequest = null; if (xhr) xhr.abort();
 pendingFile = null; $('attachment-input').value = ''; $('attachment-draft').hidden = true;
 $('view-once').checked = false; $('view-once').disabled = false;
 $('upload-progress').hidden = true; $('upload-progress').value = 0;
 $('upload-file').disabled = false; $('upload-file').textContent = 'Send file';
 $('attach').disabled = status !== 'chat'; $('attachment-error').textContent = '';
}
$('attach').onclick = () => $('attachment-input').click();
$('remove-file').onclick = clearAttachment;
$('attachment-input').onchange = () => {
 const file = $('attachment-input').files[0]; if (!file) return;
 clearAttachment();
 if (status !== 'chat') return;
 const image = /\.(png|jpe?g|gif|webp)$/i.test(file.name);
 if (!image && !/\.(txt|md|csv|json|log)$/i.test(file.name)) { $('attachment-error').textContent = 'You can send PNG, JPEG, GIF, WebP, TXT, Markdown, CSV, JSON and log files.'; return; }
 if (!file.size || file.size > (image ? 10 : 1) * 1024 * 1024) { $('attachment-error').textContent = image ? 'Choose a photo up to 10 MB. The file must not be empty.' : 'Choose a text file up to 1 MB. The file must not be empty.'; return; }
 pendingFile = file; $('attachment-name').textContent = file.name; $('attachment-size').textContent = fileSize(file.size);
 $('attachment-draft').hidden = false; $('view-once').disabled = !image;
};
$('upload-file').onclick = () => {
 if (!pendingFile || status !== 'chat' || uploadRequest) return;
 const params = new URLSearchParams({ room, name: pendingFile.name, viewOnce: String($('view-once').checked) });
 const xhr = new XMLHttpRequest(); uploadRequest = xhr;
 xhr.open('POST', `/api/attachments?${params}`); xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.timeout = 35000;
 $('upload-file').disabled = true; $('view-once').disabled = true; $('attach').disabled = true;
 $('upload-file').textContent = 'Sending…'; $('upload-progress').hidden = false; $('attachment-error').textContent = '';
 xhr.upload.onprogress = e => { if (e.lengthComputable) $('upload-progress').value = Math.round(100 * e.loaded / e.total); };
 const failure = message => {
  if (uploadRequest !== xhr) return;
  uploadRequest = null; $('upload-file').disabled = false; $('upload-file').textContent = 'Send again';
  $('attach').disabled = status !== 'chat'; $('view-once').disabled = !/\.(png|jpe?g|gif|webp)$/i.test(pendingFile?.name || '');
  $('upload-progress').hidden = true; $('attachment-error').textContent = message;
 };
 xhr.onload = () => {
  if (uploadRequest !== xhr) return;
  if (xhr.status === 201) { uploadRequest = null; clearAttachment(); }
  else { let message = 'Could not send the file. Please try again.'; try { message = JSON.parse(xhr.responseText).error || message; } catch {} failure(message); }
 };
 xhr.onerror = () => failure('Upload stopped. Check your internet connection and try again.');
 xhr.ontimeout = () => failure('The upload took too long. Please try again.');
 xhr.send(pendingFile);
};
function appendAttachment(event) {
 const file = event.attachment;
 const row = document.createElement('div'); row.className = 'message-row' + (event.mine ? ' mine' : ''); row.id = `attachment-${file.id}`;
 const label = document.createElement('span'); label.className = 'message-label'; label.textContent = event.mine ? 'You' : 'Friend';
 const card = document.createElement('div'); card.className = 'attachment-card';
 const title = document.createElement('strong'); title.textContent = file.name;
 const meta = document.createElement('span'); meta.textContent = `${fileSize(file.size)} · ${file.viewOnce ? 'View once photo' : file.image ? 'Photo' : 'Text file'}`;
 const open = document.createElement('button'); open.type = 'button'; open.className = 'open-attachment';
 open.textContent = file.viewOnce ? event.mine ? 'View once photo sent' : 'Open once' : file.image ? 'View photo' : 'View file';
 open.disabled = file.viewOnce && event.mine;
 open.onclick = async () => {
  if (status !== 'chat') return;
  const viewingRoom = room; open.disabled = true;
  try {
   const response = await fetch(file.previewUrl, { cache: 'no-store' });
   if (!response.ok) { const result = await response.json(); throw Error(result.error); }
   if (file.image) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (room !== viewingRoom || status !== 'chat') return;
    let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
    showDialog(file.viewOnce ? 'View once photo' : 'Photo from your chat', '<div id="photo-viewer"></div>' + (file.viewOnce ? '<p class="capture-note">You can open this photo only once. You cannot open it again after closing it.</p>' : ''), file.viewOnce ? 'VIEW ONCE' : 'PHOTO');
    const image = document.createElement('img'); image.src = `data:${file.mime};base64,${btoa(binary)}`; image.alt = file.name; image.onerror = () => { image.remove(); if ($('photo-viewer')) $('photo-viewer').textContent = 'Could not show this photo.'; }; $('photo-viewer').append(image);
   } else {
    const text = await response.text(); if (room !== viewingRoom || status !== 'chat') return;
    showDialog('Text file', '<pre id="photo-viewer" class="text-file-preview"></pre>', 'TEXT FILE'); $('photo-viewer').textContent = text;
   }
  } catch (e) { toast(e.message || 'This file is no longer available.'); }
  finally { if (!file.viewOnce) open.disabled = status !== 'chat'; }
 };
 card.append(title, meta, open); row.append(label, card); $('conversation').append(row); $('conversation').scrollTop = $('conversation').scrollHeight;
}
dialog.addEventListener('close', () => { if ($('photo-viewer')) $('dialog-content').replaceChildren(); });
