/* WhatsDaf: the whole daf, as a group chat. Plain JS, no build step. */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
// Commentary English may use the same tags as messages (<b>, <i>, <br>); everything else stays escaped.
const escNote = s => esc(s).replace(/&lt;(\/?)([bi])&gt;/g, '<$1$2>').replace(/&lt;br\s*\/?&gt;/g, '<br>');

// Reader state lives only in this browser.
const store = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(`whatsdaf:${key}`)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(`whatsdaf:${key}`, JSON.stringify(value)); } catch {} },
};

const state = {
  index: [], people: {}, dafCache: new Map(),
  view: 'masechtot', masechet: null, open: null, filter: 'all', query: '',
  finished: store.read('finished', {}),   // "bekhorot/40" → timestamp
  progress: store.read('progress', {}),   // "bekhorot/40" → { pct, anchor }
  starred: store.read('starred', []),     // [{ key, id }]
  notes: store.read('notes', {}),         // "bekhorot/40" → [{ id, after, text, ts, replyTo, quote }]
  replyTo: null, find: { hits: [], i: 0 },
};

const SEDER_COLORS = { zeraim: '#3f8f4f', moed: '#1f78b4', nashim: '#a6497b', nezikin: '#b2662c', kodashim: '#7a5cc4', taharot: '#2f8f8f' };
const COMMENTARY = { rashi: 'Rashi', tosafot: 'Tosafot', gershom: 'Rabbeinu Gershom' };
const ICON = {
  fwd: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 6V2l8 7-8 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11Z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7Z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4.5C6.7 3.6 9.4 3.8 12 5.2v14.3c-2.6-1.4-5.3-1.6-8-.7Zm16 0c-2.7-.9-5.4-.7-8 .7v14.3c2.6-1.4 5.3-1.6 8-.7Z"/></svg>',
  ticks: '<svg class="ticks{c}" viewBox="0 0 18 18"><path fill="currentColor" d="m17.4 4.3-.6-.5a.4.4 0 0 0-.6.1L9.6 12.1l-.8-.8-.9 1.1 1.4 1.4c.2.2.4.1.6 0l7.5-9a.4.4 0 0 0 0-.5Zm-5 0-.6-.5a.4.4 0 0 0-.6.1L4.8 12.1 2.4 9.9a.4.4 0 0 0-.6 0l-.5.6a.4.4 0 0 0 0 .5l3.4 3.2c.2.2.4.1.6 0l7.1-9.4a.4.4 0 0 0 0-.5Z"/></svg>',
  tick: '<svg class="ticks" viewBox="0 0 18 18"><path fill="currentColor" d="m12.4 4.3-.6-.5a.4.4 0 0 0-.6.1L4.8 12.1 2.4 9.9a.4.4 0 0 0-.6 0l-.5.6a.4.4 0 0 0 0 .5l3.4 3.2c.2.2.4.1.6 0l7.1-9.4a.4.4 0 0 0 0-.5Z"/></svg>',
  pin: '<svg class="pin" viewBox="0 0 24 24"><path fill="currentColor" d="M16 3v2l-1 1v6l3 3v2h-5v5h-2v-5H6v-2l3-3V6L8 5V3Z"/></svg>',
};

const keyOf = (masechet, daf) => `${masechet}/${daf}`;
const masechetOf = slug => MASECHTOT.find(m => m.slug === slug);
const built = (slug, daf) => state.index.find(d => d.masechet === slug && d.daf === daf);
const builtIn = slug => state.index.filter(d => d.masechet === slug);
const today = () => dafYomiFor(new Date());

function dayDiff(date) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 864e5);
}
function whenLabel(slug, daf) {
  const d = dateForDaf(slug, daf);
  const diff = dayDiff(d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (Math.abs(diff) < 7) return local.toLocaleDateString(undefined, { weekday: 'long' });
  return local.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: Math.abs(diff) > 300 ? 'numeric' : undefined });
}

function avatar(id, cls = '') {
  const p = state.people[id] || { name: id, initials: '?', color: '#8696a0' };
  const img = p.image ? `<img src="assets/portraits/${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="av ${cls}" style="background:${p.color}" title="${esc(p.name)}"><span class="ini">${esc(p.initials)}</span>${img}</span>`;
}
function masechetAvatar(m, cls = '', text) {
  const len = (text || m.he).length;
  return `<span class="av ${cls}" style="background:${SEDER_COLORS[m.seder]}"><span class="ini" style="--k:${len > 5 ? .22 : len > 3 ? .27 : .34}">${esc(text || m.he)}</span></span>`;
}
const personName = id => state.people[id]?.name || id;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ── Chat list ───────────────────────────────────────────── */

function dafStatus(key) {
  if (state.finished[key]) return 'finished';
  if (state.progress[key]?.pct > 0.02) return 'started';
  return 'unread';
}
const statusTicks = s => s === 'finished' ? ICON.ticks.replace('{c}', ' read') : s === 'started' ? ICON.tick : '';

function masechetItem(m) {
  const dafim = builtIn(m.slug);
  if (!dafim.length) {
    return `<li class="item disabled" aria-disabled="true">${masechetAvatar(m)}<div class="item-main">
      <span class="item-title">${esc(m.name)}<span class="he">${esc(m.he)}</span></span><span class="item-when"></span>
      <span class="item-sub">Coming soon</span><span></span></div></li>`;
  }
  const latest = dafim[dafim.length - 1];
  const unread = dafim.filter(d => dafStatus(keyOf(d.masechet, d.daf)) !== 'finished').length;
  return `<li class="item ${unread ? 'unread' : ''} ${state.masechet === m.slug ? 'selected' : ''}" data-masechet="${m.slug}">${masechetAvatar(m)}<div class="item-main">
    <span class="item-title">${esc(m.name)}<span class="he">${esc(m.he)}</span></span><span class="item-when">${esc(whenLabel(latest.masechet, latest.daf))}</span>
    <span class="item-sub"><b>${esc(personName(latest.preview.from))}:</b> ${esc(latest.preview.text)}</span>
    <span class="item-badges">${unread ? `<span class="badge">${unread}</span>` : ''}</span></div></li>`;
}

function dafItem(slug, daf, { pinned = false } = {}) {
  const m = masechetOf(slug), d = built(slug, daf), key = keyOf(slug, daf);
  const t = today(), isToday = t.masechet === slug && t.daf === daf;
  const title = pinned ? `Today’s daf · ${m.name} ${daf}` : `${m.name} ${daf}`;
  const av = masechetAvatar(m, '', hebrewNumeral(daf));
  if (!d) {
    return `<li class="item disabled ${pinned ? 'pinned' : ''}" aria-disabled="true">${av}<div class="item-main">
      <span class="item-title">${esc(title)}</span><span class="item-when">${esc(whenLabel(slug, daf))}</span>
      <span class="item-sub">Coming soon</span><span class="item-badges">${pinned ? ICON.pin : ''}</span></div></li>`;
  }
  const status = dafStatus(key), open = state.open && state.open.masechet === slug && state.open.daf === daf;
  return `<li class="item ${status === 'unread' ? 'unread' : ''} ${open ? 'selected' : ''} ${pinned ? 'pinned' : ''}" data-daf="${key}">${av}<div class="item-main">
    <span class="item-title">${esc(title)}</span><span class="item-when">${esc(whenLabel(slug, daf))}</span>
    <span class="item-sub">${statusTicks(status)} <b>${esc(personName(d.preview.from))}:</b> ${esc(d.preview.text)}</span>
    <span class="item-badges">${isToday && !pinned ? '<span class="tag">Today</span>' : ''}${pinned ? ICON.pin : ''}${status === 'unread' ? '<span class="badge">' + d.messages + '</span>' : ''}</span></div></li>`;
}

function starredItems() {
  if (!state.starred.length) return '<li class="section-label">No starred messages yet. Tap any message, then ★ Star.</li>';
  return state.starred.map(s => {
    const [slug, daf] = s.key.split('/');
    return `<li class="item" data-daf="${s.key}" data-msg="${s.id}">${avatar(s.from)}<div class="item-main">
      <span class="item-title">${esc(personName(s.from))}</span><span class="item-when">${esc(masechetOf(slug).name)} ${daf}</span>
      <span class="item-sub">${esc(s.text)}</span><span></span></div></li>`;
  }).join('');
}

async function searchResults(q) {
  const ql = q.toLowerCase();
  const masechtot = MASECHTOT.filter(m => m.name.toLowerCase().includes(ql) || m.he.includes(q) || m.slug.includes(ql));
  const dafMatch = q.match(/^(.*?)\s*(\d{1,3})$/);
  const dafim = dafMatch ? MASECHTOT.filter(m => !dafMatch[1] || m.name.toLowerCase().startsWith(dafMatch[1].toLowerCase()))
    .filter(m => +dafMatch[2] >= m.first && +dafMatch[2] <= m.last).slice(0, 6).map(m => [m.slug, +dafMatch[2]]) : [];
  let html = '';
  if (dafim.length) html += '<li class="section-label">Dapim</li>' + dafim.map(([s, d]) => dafItem(s, d)).join('');
  if (masechtot.length) html += '<li class="section-label">Masechtot</li>' + masechtot.map(masechetItem).join('');
  if (q.length >= 3) {
    const hits = [];
    for (const d of state.index) {
      const data = await loadDaf(d.masechet, d.daf);
      for (const msg of data.messages) {
        if (msg.kind !== 'message') continue;
        const text = plain(msg.text);
        const at = text.toLowerCase().indexOf(ql);
        if (at >= 0) hits.push({ d, msg, snippet: (at > 14 ? '…' : '') + text.slice(Math.max(0, at - 14), at + 100) });
        if (hits.length >= 40) break;
      }
    }
    if (hits.length) {
      const mark = s => esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), x => `<mark>${x}</mark>`);
      html += '<li class="section-label">Messages</li>' + hits.map(h => `<li class="item" data-daf="${keyOf(h.d.masechet, h.d.daf)}" data-msg="${h.msg.id}">${avatar(h.msg.from)}<div class="item-main">
        <span class="item-title">${esc(personName(h.msg.from))}</span><span class="item-when">${esc(h.d.title)}</span>
        <span class="item-sub">${mark(h.snippet)}</span><span></span></div></li>`).join('');
    }
  }
  return html || '<li class="section-label">No results</li>';
}

async function renderList() {
  const list = $('#chatList');
  const keep = list.scrollTop;
  const inMasechet = state.view === 'dafim' && state.masechet && !state.query;
  $('#listHead').hidden = !inMasechet;
  document.querySelectorAll('#chips button').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));

  if (state.query) { list.innerHTML = await searchResults(state.query); return; }
  if (state.filter === 'starred') { list.innerHTML = starredItems(); return; }
  const t = today();

  if (state.filter === 'today') {
    list.innerHTML = dafItem(t.masechet, t.daf, { pinned: true });
    const next = dafYomiFor(new Date(Date.now() + 864e5));
    if (built(next.masechet, next.daf)) list.innerHTML += '<li class="section-label">Tomorrow</li>' + dafItem(next.masechet, next.daf);
    return;
  }

  if (inMasechet) {
    const m = masechetOf(state.masechet);
    $('#listTitle').textContent = m.name; $('#listSub').textContent = m.he;
    let html = '';
    for (let d = m.first; d <= m.last; d++) {
      const st = dafStatus(keyOf(m.slug, d));
      if (state.filter === 'unread' && (!built(m.slug, d) || st === 'finished')) continue;
      html += dafItem(m.slug, d);
    }
    list.innerHTML = html || '<li class="section-label">Nothing unread here.</li>';
    if (renderList.keepScroll) list.scrollTop = keep;
    const focus = list.querySelector('.item.selected') || list.querySelector('.item:not(.disabled)');
    if (focus && !renderList.keepScroll) list.scrollTop = focus.offsetTop - list.offsetTop - list.clientHeight / 2 + focus.offsetHeight / 2;
    return;
  }

  let html = dafItem(t.masechet, t.daf, { pinned: true });
  for (const m of MASECHTOT) {
    if (state.filter === 'unread' && !builtIn(m.slug).some(d => dafStatus(keyOf(d.masechet, d.daf)) !== 'finished')) continue;
    html += masechetItem(m);
  }
  list.innerHTML = html;
}

/* ── Loading ─────────────────────────────────────────────── */

async function loadDaf(slug, daf) {
  const key = keyOf(slug, daf);
  if (!state.dafCache.has(key)) state.dafCache.set(key, fetch(`data/${slug}/${daf}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  return state.dafCache.get(key);
}

/* ── Chat ────────────────────────────────────────────────── */

function bubbleHtml(msg, data, { first }) {
  const p = state.people[msg.from] || {};
  const starred = state.starred.some(s => s.key === keyOf(data.masechet, data.daf) && s.id === msg.id);
  const quoted = msg.replyTo && data.messages.find(x => x.id === msg.replyTo);
  const amud = msg.seg ? `${data.daf}${msg.seg[0]}` : '';
  let fwd = '';
  if (msg.forwardedFrom) fwd = `<div class="fwd">${ICON.fwd} Forwarded from ${esc(personName(msg.forwardedFrom))}</div>`;
  else if (msg.forwarded) fwd = `<div class="fwd">${ICON.fwd} Forwarded · ${esc(msg.forwarded)}</div>`;
  const quote = quoted ? `<a class="quote" data-jump="${quoted.id}" style="border-color:${state.people[quoted.from]?.color}">
      <b style="color:${state.people[quoted.from]?.color}">${esc(personName(quoted.from))}</b><span>${esc(msg.quote || plain(quoted.text))}</span></a>` : '';
  const verse = msg.verse ? `<a class="verse" href="https://www.sefaria.org/${encodeURIComponent(msg.verse.ref.replace(/ /g, '_'))}?lang=bi" target="_blank" rel="noopener">
      <div class="v-he" dir="rtl">${msg.verse.he}</div><div class="v-en">${esc(msg.verse.en)}</div><div class="v-ref">${esc(msg.verse.ref)} · sefaria.org</div></a>` : '';
  const notes = msg.notes?.length ? `<span class="has-notes" title="Commentary on this message">${ICON.book}${msg.notes.length}</span>` : '';
  return `<div class="row ${first ? 'first' : ''} ${msg.reactions ? 'has-reaction' : ''}" data-id="${msg.id}">
    ${first ? avatar(msg.from) : '<span class="av-spacer"></span>'}
    <div class="bubble ${msg.mishna ? 'mishna' : ''}" id="${msg.id}">
      ${first || msg.alt ? `<div class="name-row"><span class="name" style="color:${p.color}">${esc(p.name)}</span>${msg.alt ? `<span class="alt">${esc(msg.alt)}</span>` : ''}${msg.mishna && first ? '<span class="mishna-tag">Mishna</span>' : ''}</div>` : ''}
      ${fwd}${quote}${msg.lead ? `<div class="lead">${msg.lead}</div>` : ''}
      <div class="text">${msg.text}<span class="meta">${starred ? `<span title="Starred">${ICON.star}</span>` : ''}${notes}<span>${amud}</span></span></div>
      ${verse}
      ${msg.reactions ? `<span class="reactions">${msg.reactions.join('')}</span>` : ''}
    </div></div>`;
}

function noteHtml(n, first) {
  const quoted = n.replyTo ? `<a class="quote" data-jump="${n.replyTo}" style="border-color:var(--brand-strong)"><b style="color:var(--brand)">${esc(personName(n.replyFrom))}</b><span>${esc(n.quote)}</span></a>` : '';
  const time = new Date(n.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `<div class="row out ${first ? 'first' : ''}" data-note="${n.id}"><div class="bubble">${quoted}<div class="text">${esc(n.text)}<span class="meta">${n.done ? '' : `<button class="note-actions" data-delete-note="${n.id}" title="Delete note">Delete</button>`}<span>${time}</span>${ICON.ticks.replace('{c}', ' read')}</span></div></div></div>`;
}

function renderChat(data) {
  const key = keyOf(data.masechet, data.daf);
  const notes = state.notes[key] || [];
  const notesAfter = id => notes.filter(n => n.after === id);
  let html = '', prevSender = null;
  const flushNotes = id => {
    notesAfter(id).forEach((n, i) => { html += noteHtml(n, i === 0); });
    if (notesAfter(id).length) prevSender = '__me';
  };
  for (const msg of data.messages) {
    if (msg.kind === 'divider') { html += `<div class="day-pill" data-amud="${esc(msg.text)}">${esc(msg.text)}</div>`; prevSender = null; }
    else if (msg.kind === 'section') { html += `<div class="section-pill">${esc(msg.text)}</div>`; prevSender = null; }
    else if (msg.kind === 'system') { html += `<div class="system ${msg.style === 'refuted' ? 'refuted' : ''}" id="${msg.id}">${msg.text}</div>`; prevSender = null; }
    else if (msg.kind === 'image') {
      html += `<figure class="photo" id="${msg.id}" data-src="${esc(msg.src)}"><img src="${esc(msg.src)}" alt="${esc(msg.caption)}" loading="lazy"><p>${esc(msg.caption)}</p><small>WhatsDaf diagram</small></figure>`;
      prevSender = null;
    } else {
      html += bubbleHtml(msg, data, { first: prevSender !== msg.from });
      prevSender = msg.from;
    }
    flushNotes(msg.id);
  }
  if (state.finished[key]) html += noteHtml({ id: 'done', ts: state.finished[key], text: `Finished ${data.title} ✓`, done: true }, true);
  $('#messages').innerHTML = html;
}

async function openDaf(slug, daf, msgId) {
  const m = masechetOf(slug);
  if (!m || !built(slug, daf)) { toast(`${m ? m.name : slug} ${daf} isn’t ready yet`); return; }
  closePopover(); closeDrawer(); closeFind(); setReply(null);
  const data = await loadDaf(slug, daf);
  const sameDaf = state.open && state.open.masechet === slug && state.open.daf === daf;
  state.open = data; state.masechet = slug; state.view = 'dafim';
  document.title = `${data.title} · WhatsDaf`;
  $('#emptyState').hidden = true; $('#chat').hidden = false;
  $('#app').classList.add('in-chat');
  $('#chatAvatar').outerHTML = masechetAvatar(m, 'big', hebrewNumeral(daf)).replace('class="av', 'id="chatAvatar" class="av');
  $('#chatTitle').innerHTML = `${esc(data.title)}<span class="he">${esc(data.he)}</span>`;
  $('#chatMembers').textContent = data.members.map(personName).join(', ');
  if (!sameDaf) renderChat(data);
  renderList();

  const box = $('#messages');
  const key = keyOf(slug, daf), prog = state.progress[key];
  $('#resume').hidden = true;
  if (msgId) {
    requestAnimationFrame(() => jumpTo(msgId));
  } else if (!sameDaf) {
    box.scrollTop = 0;
    if (prog && prog.anchor && !state.finished[key] && prog.pct > 0.03) {
      $('#resume').textContent = `↓ Continue where you left off (${Math.round(prog.pct * 100)}%)`;
      $('#resume').dataset.anchor = prog.anchor; $('#resume').hidden = false;
    }
  }
  updateProgress();
}

function closeChat() {
  state.open = null; $('#chat').hidden = true; $('#emptyState').hidden = false; $('#app').classList.remove('in-chat');
  document.title = 'WhatsDaf'; closePopover(); closeDrawer();
}

function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/* Progress: the scrollbar already shows how much is left; the bar and amud label make it explicit. */
let saveTimer;
function updateProgress() {
  if (!state.open) return;
  const box = $('#messages');
  const max = box.scrollHeight - box.clientHeight;
  const pct = max <= 0 ? 1 : Math.min(1, box.scrollTop / max);
  $('#progress span').style.width = `${pct * 100}%`;
  const top = box.getBoundingClientRect().top;
  let amud = '';
  for (const pill of box.querySelectorAll('.day-pill')) if (pill.getBoundingClientRect().top - top < box.clientHeight * 0.5) amud = pill.dataset.amud;
  $('#progressLabel').textContent = `${state.open.daf}${amud.replace(/^\d+/, '') ? amud.replace(/^\d+/, '') : 'a'} · ${Math.round(pct * 100)}%`;
  $('#toBottom').hidden = max - box.scrollTop < 400;
  if (!$('#resume').hidden && pct > 0.05) $('#resume').hidden = true;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const key = keyOf(state.open.masechet, state.open.daf);
    const anchor = [...box.querySelectorAll('.bubble[id], .system[id], .photo[id]')].find(el => el.getBoundingClientRect().bottom > top + 10);
    const prev = state.progress[key]?.pct || 0;
    state.progress[key] = { pct: Math.max(prev, pct), anchor: anchor?.id, at: Date.now() };
    store.write('progress', state.progress);
    if (pct > 0.985 && !state.finished[key]) {
      state.finished[key] = Date.now(); store.write('finished', state.finished);
      renderChat(state.open); box.scrollTop = box.scrollHeight;
      toast(`Finished ${state.open.title} ✓`);
    }
    renderList.keepScroll = true; renderList(); renderList.keepScroll = false;
  }, 350);
}

/* ── Commentary popover ──────────────────────────────────── */

function openPopover(msgId, anchorEl) {
  const data = state.open, msg = data.messages.find(m => m.id === msgId);
  if (!msg) return;
  const seg = msg.seg && data.segments[msg.seg];
  const groups = Object.keys(COMMENTARY).map(by => [by, (msg.notes || []).filter(n => n.by === by)]).filter(([, ns]) => ns.length);
  const tabs = [...groups.map(([by, ns]) => ({ id: by, label: `${COMMENTARY[by]} · ${ns.length}` })), ...(seg ? [{ id: 'original', label: 'Original' }] : [])];
  const key = keyOf(data.masechet, data.daf);
  const isStarred = state.starred.some(s => s.key === key && s.id === msgId);
  const pop = $('#popover');
  pop.innerHTML = `
    <div class="pop-head">${avatar(msg.from, 'small')}<div class="t"><b>${esc(personName(msg.from))}</b><small>${seg ? esc(seg.ref) : esc(data.title)}${groups.length ? '' : ' · no commentary on this line'}</small></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="pop-tabs">${tabs.map((t, i) => `<button data-tab="${t.id}" class="${i === 0 ? 'active' : ''}">${esc(t.label)}</button>`).join('')}</div>
    <div class="pop-body"></div>
    <div class="pop-actions">
      <button data-act="star">${isStarred ? '★ Unstar' : '☆ Star'}</button>
      <button data-act="reply">↩ Reply with a note</button>
      <button data-act="link">🔗 Copy link</button>
    </div>`;
  const body = pop.querySelector('.pop-body');
  const show = tab => {
    pop.querySelectorAll('.pop-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'original') {
      body.innerHTML = `<div class="original"><p dir="rtl">${seg.he}</p><a href="${seg.url}" target="_blank" rel="noopener">Open ${esc(seg.ref)} on Sefaria ↗</a>
        <div class="pop-disclaimer">The whole passage, which may span several messages.</div></div>`;
    } else {
      const ns = groups.find(([by]) => by === tab)[1];
      body.innerHTML = ns.map(n => `<div class="note">${n.dh ? `<div class="dh" dir="rtl">${n.dh}</div>` : ''}
        <div class="en">${escNote(n.en)}</div>
        <details><summary>Hebrew</summary><p dir="rtl">${n.he}</p></details>
        <a href="${n.url}" target="_blank" rel="noopener">Open on Sefaria ↗</a></div>`).join('') +
        '<div class="pop-disclaimer">English is a WhatsDaf rendering of the Hebrew. Check the original for precise learning.</div>';
    }
  };
  show(tabs[0]?.id);
  pop.onclick = e => {
    const t = e.target.closest('[data-tab]'); if (t) return show(t.dataset.tab);
    if (e.target.closest('[data-close]')) return closePopover();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'star') { toggleStar(msg); closePopover(); }
    if (act === 'reply') { setReply(msg); closePopover(); $('#noteInput').focus(); }
    if (act === 'link') {
      const url = `${location.origin}${location.pathname}#/${data.masechet}/${data.daf}/${msg.id}`;
      navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast(url));
      closePopover();
    }
  };
  pop.hidden = false;
  if (!document.querySelector('.scrim')) { const s = document.createElement('div'); s.className = 'scrim'; s.onclick = closePopover; document.body.append(s); }
  // Anchor beside the bubble on wide screens; CSS turns it into a bottom sheet on phones.
  const r = anchorEl.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let left = r.right + 12; if (left + w > innerWidth - 12) left = Math.max(12, Math.min(r.left, innerWidth - w - 12));
  let top = Math.min(Math.max(12, r.top), innerHeight - h - 12);
  if (left < r.right && left + w > r.left) top = r.bottom + 8 + h < innerHeight ? r.bottom + 8 : Math.max(12, r.top - h - 8);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;
}
function closePopover() { $('#popover').hidden = true; document.querySelector('.scrim')?.remove(); }

function toggleStar(msg) {
  const key = keyOf(state.open.masechet, state.open.daf);
  const i = state.starred.findIndex(s => s.key === key && s.id === msg.id);
  if (i >= 0) state.starred.splice(i, 1);
  else state.starred.unshift({ key, id: msg.id, from: msg.from, text: plain(msg.text).slice(0, 140) });
  store.write('starred', state.starred);
  const keep = $('#messages').scrollTop; renderChat(state.open); $('#messages').scrollTop = keep;
  toast(i >= 0 ? 'Unstarred' : 'Starred');
}

/* ── Notes (the reader's own green bubbles) ──────────────── */

function setReply(msg) {
  state.replyTo = msg;
  const box = $('#replyPreview');
  if (!msg) { box.hidden = true; return; }
  box.innerHTML = `<div><b>${esc(personName(msg.from))}</b><span>${esc(plain(msg.text))}</span></div><button type="button" class="icon-btn" aria-label="Cancel reply">✕</button>`;
  box.querySelector('button').onclick = () => setReply(null);
  box.hidden = false;
}

function addNote(text) {
  const data = state.open, key = keyOf(data.masechet, data.daf), box = $('#messages');
  let after = state.replyTo?.id;
  if (!after) {
    // Attach the note after the last message the reader can see.
    const visible = [...box.querySelectorAll('.bubble[id], .system[id], .photo[id]')].filter(el => el.getBoundingClientRect().top < box.getBoundingClientRect().bottom - 20);
    after = visible.length ? visible[visible.length - 1].id : data.messages[0].id;
  }
  const n = { id: `n${Date.now()}`, after, text, ts: Date.now() };
  if (state.replyTo) Object.assign(n, { replyTo: state.replyTo.id, replyFrom: state.replyTo.from, quote: plain(state.replyTo.text).slice(0, 140) });
  (state.notes[key] ||= []).push(n);
  store.write('notes', state.notes);
  const keep = box.scrollTop; renderChat(data); box.scrollTop = keep;
  setReply(null);
  document.querySelector(`[data-note="${n.id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function deleteNote(id) {
  const key = keyOf(state.open.masechet, state.open.daf);
  state.notes[key] = (state.notes[key] || []).filter(n => n.id !== id);
  store.write('notes', state.notes);
  const keep = $('#messages').scrollTop; renderChat(state.open); $('#messages').scrollTop = keep;
}

/* ── Group info drawer ───────────────────────────────────── */

function openDrawer() {
  const data = state.open, m = masechetOf(data.masechet);
  $('#drawerTitle').textContent = 'Group info';
  $('#drawerBody').innerHTML = `
    <div class="drawer-card center">${masechetAvatar(m, 'huge', hebrewNumeral(data.daf))}
      <h2>${esc(data.title)}<span class="he">${esc(data.he)}</span></h2>
      <p class="muted">Group · ${data.members.length} members · Daf Yomi: ${esc(whenLabel(data.masechet, data.daf))}</p></div>
    <div class="drawer-card"><h3>Description</h3><p>${esc(data.description)}</p></div>
    <div class="drawer-card"><h3>On this daf</h3><ul>${data.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="drawer-card"><h3>${data.members.length} members</h3>${data.members.map(id => {
      const p = state.people[id];
      return `<div class="member">${avatar(id, 'member')}<div><b>${esc(p.name)}</b> <span class="he muted">${esc(p.he)}</span><small>${esc(p.era)}</small><em>${esc(p.bio)}</em></div></div>`;
    }).join('')}</div>
    <div class="drawer-card"><h3>Reading the chat</h3>
      <p><b>Bold</b> is the daf’s own words in translation; regular type is the explanation woven in. <i>Italics</i> are Hebrew and Aramaic terms.</p>
      <p>Gold bubbles are the Mishna. <i>Forwarded</i> messages are teachings quoted from elsewhere. Tap any message for Rashi, Tosafot, Rabbeinu Gershom and the original Aramaic.</p></div>
    <div class="drawer-card"><h3>Sources</h3><p class="muted">${esc(data.attribution)}</p>
      <p><a href="${data.sefaria}" target="_blank" rel="noopener">Open ${esc(data.title)} on Sefaria ↗</a></p>
      <p class="muted">A learning project. Chat framing and commentary renderings are WhatsDaf’s own; always check the source, and ask a qualified authority for practical halakha.</p>
      <p><button class="pill-btn ghost" id="markUnread">Mark as unread</button></p></div>`;
  $('#markUnread').onclick = () => {
    const key = keyOf(data.masechet, data.daf);
    delete state.finished[key]; delete state.progress[key];
    store.write('finished', state.finished); store.write('progress', state.progress);
    renderChat(data); $('#messages').scrollTop = 0; closeDrawer(); renderList(); toast('Marked as unread');
  };
  $('#drawer').hidden = false;
}

function openAbout() {
  $('#drawerTitle').textContent = 'About WhatsDaf';
  $('#drawerBody').innerHTML = `
    <div class="drawer-card center"><img src="assets/logo.svg" alt="" width="120" height="120"><h2>WhatsDaf</h2><p class="muted">The whole daf, as a group chat.</p></div>
    <div class="drawer-card"><p>Every daf is a group chat. The Tannaim and Amoraim on the daf are its members, the Gemara asks and answers, and the Mishna’s lines are tinted gold. The chat carries the whole text of the daf, not a summary.</p>
      <p>Tap a message for Rashi, Tosafot and Rabbeinu Gershom, or the original Aramaic. Star the lines you want to keep and write your own notes in green; they stay in this browser.</p></div>
    <div class="drawer-card"><h3>Sources</h3><p class="muted">English: The William Davidson Talmud (Koren–Steinsaltz), CC BY-NC, via <a href="https://www.sefaria.org" target="_blank" rel="noopener">Sefaria</a>. Commentaries in Hebrew from Sefaria; English renderings by WhatsDaf. Portraits are imaginative.</p>
      <p class="muted">A learning project, not psak. Always check the source.</p></div>`;
  $('#drawer').hidden = false;
}
function closeDrawer() { $('#drawer').hidden = true; }

/* ── Find in daf ─────────────────────────────────────────── */

function closeFind() { $('#findBar').hidden = true; $('#findInput').value = ''; clearFind(); }
function clearFind() { document.querySelectorAll('#messages mark').forEach(m => m.replaceWith(...m.childNodes)); $('#findCount').textContent = ''; state.find = { hits: [], i: 0 }; }
function runFind(q) {
  clearFind();
  if (q.length < 2) return;
  const walker = document.createTreeWalker($('#messages'), NodeFilter.SHOW_TEXT);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const nodes = []; while (walker.nextNode()) if (re.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const frag = document.createDocumentFragment(); let last = 0; const s = node.nodeValue;
    s.replace(re, (m, at) => { frag.append(s.slice(last, at)); const mk = document.createElement('mark'); mk.textContent = m; frag.append(mk); state.find.hits.push(mk); last = at + m.length; });
    frag.append(s.slice(last)); node.replaceWith(frag);
  }
  stepFind(0);
}
function stepFind(d) {
  const { hits } = state.find;
  if (!hits.length) { $('#findCount').textContent = 'No results'; return; }
  state.find.i = (state.find.i + d + hits.length) % hits.length;
  hits[state.find.i].scrollIntoView({ block: 'center' });
  $('#findCount').textContent = `${state.find.i + 1} of ${hits.length}`;
}

/* ── Routing ─────────────────────────────────────────────── */

function route() {
  const [slug, daf, msg] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (slug && daf) { openDaf(slug, +daf, msg); return; }
  if (slug && masechetOf(slug)) { state.view = 'dafim'; state.masechet = slug; closeChat(); renderList(); return; }
  state.view = 'masechtot'; state.masechet = null; closeChat(); renderList();
}

function renderEmptyActions() {
  const t = today(), tm = masechetOf(t.masechet);
  const ready = [...state.index].sort((a, b) => dateForDaf(a.masechet, a.daf) - dateForDaf(b.masechet, b.daf))
    .find(d => dayDiff(dateForDaf(d.masechet, d.daf)) >= 0) || state.index[state.index.length - 1];
  let html = built(t.masechet, t.daf)
    ? `<button class="pill-btn" data-go="${t.masechet}/${t.daf}">Today’s daf: ${tm.name} ${t.daf}</button>`
    : `<button class="pill-btn" disabled>Today’s daf: ${tm.name} ${t.daf} · coming soon</button>`;
  if (ready && !(ready.masechet === t.masechet && ready.daf === t.daf)) html += `<button class="pill-btn ghost" data-go="${ready.masechet}/${ready.daf}">Read ${ready.title} (${whenLabel(ready.masechet, ready.daf).toLowerCase()})</button>`;
  $('#emptyActions').innerHTML = html;
}

/* ── Events ──────────────────────────────────────────────── */

function bind() {
  window.addEventListener('hashchange', route);
  $('#chatList').addEventListener('click', e => {
    const item = e.target.closest('.item'); if (!item || item.classList.contains('disabled')) return;
    if (item.dataset.masechet) { state.query = ''; $('#search').value = ''; location.hash = `#/${item.dataset.masechet}`; }
    if (item.dataset.daf) {
      const target = `#/${item.dataset.daf}${item.dataset.msg ? `/${item.dataset.msg}` : ''}`;
      if (location.hash === target) route(); else location.hash = target;
    }
  });
  $('#listBack').onclick = () => { location.hash = '#/'; };
  $('#chatBack').onclick = () => { location.hash = state.masechet ? `#/${state.masechet}` : '#/'; };
  $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { state.filter = b.dataset.filter; renderList(); } });
  let searchTimer;
  $('#search').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = e.target.value.trim(); renderList(); }, 180); });
  $('#emptyActions').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) location.hash = `#/${b.dataset.go}`; });

  const box = $('#messages');
  box.addEventListener('scroll', updateProgress, { passive: true });
  box.addEventListener('click', e => {
    const jump = e.target.closest('[data-jump]'); if (jump) { e.preventDefault(); jumpTo(jump.dataset.jump); return; }
    const del = e.target.closest('[data-delete-note]'); if (del) { deleteNote(del.dataset.deleteNote); return; }
    if (e.target.closest('a')) return;
    const photo = e.target.closest('.photo');
    if (photo) { const lb = $('#lightbox'); lb.querySelector('img').src = photo.dataset.src; lb.querySelector('p').textContent = photo.querySelector('p').textContent; lb.hidden = false; return; }
    const bubble = e.target.closest('.row:not(.out) .bubble');
    if (bubble && !getSelection().toString()) openPopover(bubble.id, bubble);
  });
  $('#resume').onclick = () => { jumpTo($('#resume').dataset.anchor); $('#resume').hidden = true; };
  $('#toBottom').onclick = () => { box.scrollTop = box.scrollHeight; };
  $('#composer').addEventListener('submit', e => { e.preventDefault(); const v = $('#noteInput').value.trim(); if (v) { addNote(v); $('#noteInput').value = ''; } });
  $('#chatId').onclick = openDrawer; $('#infoBtn').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer; $('#aboutBtn').onclick = openAbout;
  $('#findBtn').onclick = () => { $('#findBar').hidden = false; $('#findInput').focus(); };
  $('#findInput').addEventListener('input', e => runFind(e.target.value.trim()));
  $('#findInput').addEventListener('keydown', e => { if (e.key === 'Enter') stepFind(e.shiftKey ? -1 : 1); if (e.key === 'Escape') closeFind(); });
  $('#findNext').onclick = () => stepFind(1); $('#findPrev').onclick = () => stepFind(-1); $('#findClose').onclick = closeFind;
  $('#lightbox').onclick = () => { $('#lightbox').hidden = true; };
  $('#themeToggle').onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'light' : 'dark'; store.write('theme', document.documentElement.dataset.theme);
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePopover(); closeDrawer(); $('#lightbox').hidden = true; } });
}

(async function init() {
  bind();
  try {
    const [index, people] = await Promise.all([fetch('data/index.json').then(r => r.json()), fetch('data/people.json').then(r => r.json())]);
    state.index = index.dafim; state.people = people.people;
  } catch (e) {
    $('#chatList').innerHTML = '<li class="section-label">Couldn’t load the dapim. If you opened index.html as a file, run a local server: python3 -m http.server</li>';
    return;
  }
  renderEmptyActions();
  route();
})();
