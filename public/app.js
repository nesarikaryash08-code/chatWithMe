const paths = {
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
let regionLoad = 0, cityLoad = 0, lastTypingSent = 0;
const originalEmpty = $('empty-state').innerHTML;
const dialog = $('info-dialog');
const pages = {
 how: ['SIMPLE BY DESIGN', 'One place. Two strangers.', '<ol><li><strong>Pick your corner.</strong> Choose a city, state, country, or people nearby. A chosen place is a chat pool, not proof of where someone lives.</li><li><strong>Find someone.</strong> We connect two people looking in the same area. If it’s quiet, you can choose to widen your search.</li><li><strong>Just say hello.</strong> Text in real time. Skip or leave whenever you like. No accounts or profiles.</li></ol><p>Closest matches people within 100 km using rounded coordinates. Availability depends on who is online.</p>'],
 safety: ['YOUR COMFORT COMES FIRST', 'A kind corner of the internet.', '<p>For adults 18 and over. An age checkbox is a self-declaration, not age verification.</p><ul><li>Keep your full name, address, phone number, and financial details private.</li><li>Never send money or follow suspicious links.</li><li>Leave any conversation that makes you uncomfortable.</li><li>Block prevents another match with that temporary session. Reports save recent messages for manual review.</li></ul><p>This first version has no staffed or automatic moderation. For immediate danger, contact local emergency services.</p>'],
 privacy: ['LESS DATA. MORE CONVERSATION.', 'Private doesn’t mean untraceable.', '<p>No signup, permanent profile, or public chat history. An essential temporary cookie routes your connection and remembers blocks for up to six hours of inactivity.</p><p>Normal messages live only in server memory during an active conversation and disappear when it ends. Reports store up to 50 recent messages with temporary session identifiers for manual review, until an operator deletes them. Don’t share sensitive information.</p><p>Selected places are shared only as area labels. Nearby matching rounds coordinates to roughly 10 km before processing and never sends coordinates to your partner.</p><p>Connections use your network address for rate limits. Hosting providers may also keep connection logs. Use HTTPS in production; chat is not end-to-end encrypted.</p>'],
 guidelines: ['A REAL PERSON ON THE OTHER SIDE', 'Be curious. Be kind.', '<ul><li>You must be 18 or older.</li><li>No harassment, hate, threats, sexual content, or exploitation.</li><li>No spam, scams, impersonation, or sharing anyone’s personal information.</li><li>Respect boundaries. A conversation can end at any time.</li></ul><p>Use Block or Report if something feels wrong. No personal information is needed to start a conversation.</p>']
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
function send(type, data = {}) { if (!ws || ws.readyState !== WebSocket.OPEN) { toast('Connection unavailable. Reconnecting…'); return false; } ws.send(JSON.stringify({ type, ...data })); return true; }
function setState(next) {
 status = next;
 const active = next === 'chat', busy = next === 'searching' || active;
 $('find').disabled = busy || !connected;
 $('find').children[1].textContent = next === 'searching' ? 'Finding someone…' : active ? 'Conversation in progress' : 'Find someone';
 document.querySelectorAll('.scope, #country, #region, #city, #adult').forEach(el => el.disabled = busy);
 $('chat-toolbar').hidden = !active;
 $('icebreakers').hidden = !active;
 $('search-actions').hidden = next !== 'searching';
 $('broaden').hidden = scope === 'country' || scope === 'nearby';
 $('message').disabled = !active;
 $('send').disabled = !active || !$('message').value.trim();
 $('message').placeholder = active ? 'A little charm goes a long way…' : 'A little spark starts with a hello…';
 $('typing').textContent = '';
 if (!active) room = null;
}
function empty(title, text, searching = false) {
 $('conversation').className = 'conversation';
 const container = document.createElement('div'); container.className = `empty-state${searching ? ' searching' : ''}`; container.innerHTML = originalEmpty;
 if (title) { container.querySelector('.state-copy h2').textContent = title; container.querySelector('.state-copy p').textContent = text; container.querySelector('.small').textContent = searching ? 'SOME THINGS ARE WORTH A LITTLE ANTICIPATION' : 'THERE’S ALWAYS ROOM FOR ANOTHER HELLO'; }
 $('conversation').replaceChildren(container); icons(container);
}
function selectScope(value) {
 scope = value; geo = null; error('');
 document.querySelectorAll('.scope').forEach(b => { b.classList.toggle('active', b.dataset.scope === value); b.setAttribute('aria-pressed', String(b.dataset.scope === value)); });
 $('location-fields').hidden = value === 'nearby'; $('nearby-info').hidden = value !== 'nearby';
 $('region-field').hidden = value === 'country'; $('city-field').hidden = value !== 'city';
 $('country').required = value !== 'nearby'; $('region').required = value === 'region' || value === 'city'; $('city').required = value === 'city';
 $('location-note').innerHTML = value === 'nearby' ? 'Location access is optional.<br>Only a broad distance label is shared.' : 'Only your chosen area is shared.<br>Your exact location stays yours.';
}
document.querySelectorAll('.scope').forEach(b => { b.onclick = () => selectScope(b.dataset.scope); });
async function locations(params = {}) { const response = await fetch('/api/locations?' + new URLSearchParams(params)); if (!response.ok) throw Error('Could not load locations. Please refresh and try again.'); return response.json(); }
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
 $('city').placeholder = list.length ? 'Search for a city' : 'No cities listed — choose State or Country';
}
async function loadRegions(preferred = '', city = '') {
 const version = ++regionLoad; ++cityLoad;
 $('region').replaceChildren(new Option('Loading regions…', '')); $('city').value = ''; $('cities').replaceChildren();
 const list = await locations({ country: $('country').value }); if (version !== regionLoad) return;
 options($('region'), list, preferred, 'No regions — choose Country');
 if (list.length) await loadCities(city); else { cities = []; $('city').placeholder = 'Choose Country for this location'; }
}
$('country').onchange = () => loadRegions().catch(e => error(e.message));
$('region').onchange = () => loadCities().catch(e => error(e.message));
$('city').oninput = () => $('city').setCustomValidity('');
async function join() {
 error('');
 if (!connected) return toast('Waiting for the connection. Please try again shortly.');
 if (!$('adult').checked) return error('Confirm you are 18 or older to continue.');
 let pool = { scope, country: $('country').value, region: $('region').value, city: $('city').value.trim() };
 if (scope === 'city' && !cities.some(c => c.id === pool.city)) { $('city').setCustomValidity('Choose a city from the suggestions.'); $('city').reportValidity(); return; }
 if (scope === 'nearby') {
   if (!navigator.geolocation) return error('Location is not supported here. Choose a city, state, or country.');
   $('find').disabled = true; $('find').children[1].textContent = 'Getting your location…';
   try { geo = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })); pool = { scope, ...geo }; }
   catch { $('find').disabled = false; $('find').children[1].textContent = 'Find someone'; return error('Location unavailable. Allow access in your browser, or choose a place manually.'); }
 }
 if (send('join', { adult: true, pool })) { setState('searching'); empty('Looking for your next hello…', 'We’ll connect you when someone in your chosen area is ready.', true); $('chat-title').textContent = 'Finding someone'; $('chat-subtitle').textContent = 'You’ll match only within your selected area.'; }
}
$('match-form').onsubmit = e => { e.preventDefault(); join(); };
$('cancel').onclick = () => { if (send('leave')) { setState('idle'); empty(); $('chat-title').textContent = 'A little room for chemistry'; $('chat-subtitle').textContent = 'Two strangers. One open-ended possibility.'; } };
$('broaden').onclick = async () => { send('leave'); setState('idle'); selectScope('country'); await join(); };
$('message').oninput = () => { $('send').disabled = status !== 'chat' || !$('message').value.trim(); if (status === 'chat' && Date.now() - lastTypingSent > 1200) { send('typing'); lastTypingSent = Date.now(); } };
document.querySelectorAll('[data-opener]').forEach(button => { button.onclick = () => { if (status !== 'chat') return; $('message').value = button.dataset.opener; $('send').disabled = false; $('message').focus(); }; });
$('message-form').onsubmit = e => { e.preventDefault(); const text = $('message').value.trim(); if (text && status === 'chat' && send('message', { text, room, id: crypto.randomUUID() })) { $('message').value = ''; $('send').disabled = true; } };
$('next').onclick = async () => { send('leave'); setState('idle'); await join(); };
$('leave').onclick = () => { send('leave'); setState('idle'); empty('A goodbye makes room for a hello.', 'Choose Find someone whenever you’re ready for another conversation.'); $('chat-title').textContent = 'Conversation ended'; $('chat-subtitle').textContent = 'Your chat has been cleared.'; };
$('block').onclick = () => {
 showDialog('Make room for a better hello.', '<p>End this chat and prevent matching with this temporary session again. Blocks last while your session is active.</p><div class="dialog-actions"><button class="secondary" id="keep-chatting">Keep chatting</button><button class="primary" id="confirm-block">Block stranger</button></div>');
 $('keep-chatting').onclick = () => dialog.close(); $('confirm-block').onclick = () => { if (send('block')) dialog.close(); };
};
$('report').onclick = () => {
 showDialog('Tell us what happened.', '<p>Your report includes the last 50 messages for manual review. Reporting also blocks this session and ends the chat.</p><form id="report-form"><label class="dialog-label" for="report-reason">Reason for reporting</label><select id="report-reason" required><option value="">Choose a reason</option><option>Harassment or hate</option><option>Sexual content</option><option>Spam or scam</option><option>Underage user</option><option>Something else</option></select><button class="primary" id="report-submit" type="submit">Submit report & end chat</button></form>');
 $('report-form').onsubmit = e => { e.preventDefault(); if (send('report', { reason: $('report-reason').value })) { $('report-submit').disabled = true; $('report-submit').textContent = 'Saving report…'; } };
};
function systemMessage(text) { const el = document.createElement('p'); el.className = 'system-message'; el.textContent = text; $('conversation').append(el); }
function appendMessage(event) {
 const row = document.createElement('div'); row.className = 'message-row' + (event.mine ? ' mine' : '');
 const label = document.createElement('span'); label.className = 'message-label'; label.textContent = event.mine ? 'You' : 'Stranger';
 const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = event.text; row.append(label, bubble); $('conversation').append(row); $('conversation').scrollTop = $('conversation').scrollHeight; $('typing').textContent = '';
}
async function stats() { try { const res = await fetch('/api/stats'); if (res.ok) { const data = await res.json(); $('online-count').textContent = `${data.online} ${data.online === 1 ? 'person' : 'people'} online`; } } catch { $('online-count').textContent = 'Offline'; } }
async function connect() {
 try {
  const response = await fetch('/api/session', { method: 'POST' }); if (!response.ok) throw Error('Unable to connect. Please try again in a minute.');
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  ws.onmessage = ({ data }) => {
   const event = JSON.parse(data);
   if (event.type === 'connected') { connected = true; setState('idle'); error(''); stats(); }
   else if (event.type === 'waiting') { setState('searching'); }
   else if (event.type === 'matched') {
    setState('chat'); room = event.room; $('conversation').replaceChildren(); $('conversation').classList.add('messages');
    systemMessage(`You’re connected with a stranger in ${event.location}. Say hello!`);
    $('chat-title').textContent = 'Stranger'; $('chat-subtitle').textContent = `${event.location} · Connected now`;
    if (innerWidth > 700) $('message').focus(); else $('chat-title').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
   } else if (event.type === 'message') appendMessage(event);
   else if (event.type === 'typing') { $('typing').textContent = 'Stranger is typing…'; clearTimeout(typingTimer); typingTimer = setTimeout(() => $('typing').textContent = '', 1800); }
   else if (event.type === 'partner_left') { setState('idle'); $('message').value = ''; systemMessage('Stranger has left. Choose Find someone to start fresh.'); $('chat-title').textContent = 'Conversation ended'; $('chat-subtitle').textContent = 'Good conversations are still out there.'; }
   else if (event.type === 'blocked' || event.type === 'reported') { setState('idle'); dialog.close(); empty('Your comfort comes first.', event.type === 'reported' ? 'Report saved. This stranger has been blocked for your session.' : 'This stranger has been blocked for your session.'); $('chat-title').textContent = 'Conversation ended'; $('chat-subtitle').textContent = 'You’re always in control.'; toast(event.type === 'reported' ? 'Report saved for manual review.' : 'Stranger blocked.'); }
   else if (event.type === 'error') { error(event.message); toast(event.message); if (status === 'searching') { send('leave'); setState('idle'); empty('Let’s try that again.', event.message); } if ($('report-submit')) { $('report-submit').disabled = false; $('report-submit').textContent = 'Submit report & end chat'; } }
  };
  ws.onclose = () => { connected = false; const wasActive = status !== 'idle'; setState('idle'); $('find').disabled = true; $('chat-title').textContent = 'Connection interrupted'; $('chat-subtitle').textContent = 'Reconnecting securely…'; if (wasActive) empty('Let’s reconnect.', 'This conversation has ended. Start a new search once you’re back online.'); error('Connection lost. Reconnecting… Close other tabs if this persists.'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 4000); };
  ws.onerror = () => {};
 } catch (e) { error(e.message); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 5000); }
}
setState('idle');
Promise.all([locations().then(async list => { countryList = list; options($('country'), list, 'IN', 'Select a country'); await loadRegions('MH', 'Pune'); }), connect()]).catch(e => error(e.message));
setInterval(stats, 15000);
