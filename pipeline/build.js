#!/usr/bin/env node
/**
 * Validate, then build data/<masechet>/<daf>.json (what the app loads) and refresh data/index.json.
 * Usage: node pipeline/build.js <masechet> <daf>     (or: node pipeline/build.js --index  to only rebuild the index)
 * Verse cards are fetched from Sefaria once and cached in pipeline/sources/verses.json.
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { validate } = require('./validate');
const { MASECHTOT, hebrewNumeral } = require('../js/masechtot');

const VERSE_CACHE = path.join(__dirname, 'sources', 'verses.json');

// Keep only the inline markup the app renders.
const clean = html => String(html)
  .replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>')
  .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '').replace(/<i class="footnote">[\s\S]*?<\/i>/g, '')
  .replace(/<(?!\/?(b|i|br)\b)[^>]+>/g, '')
  .replace(/[֑-ֽ֯]/g, '') // cantillation and meteg; keep vowels
  .replace(/\s+/g, ' ').trim();

async function verse(ref, cache) {
  if (cache[ref]) return cache[ref];
  const get = async lang => {
    const r = await fetch(`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${lang}`, { headers: { 'User-Agent': 'whatsdaf-pipeline' } });
    const j = await r.json();
    const t = j.versions?.[0]?.text;
    return clean(Array.isArray(t) ? t.join(' ') : t || '');
  };
  cache[ref] = { ref, he: await get('hebrew'), en: await get('english') };
  return cache[ref];
}

function splitDh(by, he) {
  const text = clean(he);
  const sep = by === 'gershom' ? text.indexOf('. ') : text.indexOf(' - ');
  if (sep > 0 && sep < 80) return { dh: text.slice(0, sep).replace(/[.:]$/, ''), he: text.slice(sep + (by === 'gershom' ? 2 : 3)) };
  return { dh: '', he: text };
}

const sefariaUrl = ref => `https://www.sefaria.org/${ref.replace(/ on /g, '_on_').replace(/ (?=\d)/, '.').replace(/:/g, '.').replace(/ /g, '_')}?lang=bi`;

async function build(slug, daf) {
  const { errors, warnings } = validate(slug, daf);
  for (const w of warnings) console.log(`warn  ${w}`);
  if (errors.length) { errors.forEach(e => console.log(`ERROR ${e}`)); throw new Error(`${slug} ${daf} failed validation`); }

  const { masechet, source, content, notes, people } = L.loadDaf(slug, daf);
  const segs = new Map(L.segments(source).map(s => [s.key, s]));
  const allNotes = L.commentaryNotes(source, slug);
  const cache = fs.existsSync(VERSE_CACHE) ? L.readJSON(VERSE_CACHE) : {};
  const idOf = new Map(content.messages.map((m, i) => [m.id || `m${i + 1}`, `m${i + 1}`]));

  const messages = [];
  for (const [i, m] of content.messages.entries()) {
    const out = { id: `m${i + 1}`, kind: m.kind || 'message' };
    for (const k of ['from', 'seg', 'alt', 'style', 'src', 'caption', 'reactions']) if (m[k] !== undefined) out[k] = m[k];
    if (m.text) out.text = m.text.replace(/@\{([\w-]+)\}/g, (_, id) => `<span class="mention">@${people[id].name}</span>`);
    if (m.lead) out.lead = m.lead;
    if (m.mishna) out.mishna = true;
    if (m.forwarded) out.forwarded = m.forwarded;
    if (m.forwardedFrom) out.forwardedFrom = m.forwardedFrom;
    if (m.replyTo) { out.replyTo = idOf.get(m.replyTo); out.quote = m.quote || ''; }
    if (m.verse) out.verse = await verse(m.verse, cache);
    if (m.notes) out.notes = m.notes.map(key => {
      const n = allNotes.get(key);
      return { key, by: n.by, ref: n.ref, url: sefariaUrl(n.ref), ...splitDh(n.by, n.he), en: notes[key] };
    });
    messages.push(out);
  }
  fs.mkdirSync(path.dirname(VERSE_CACHE), { recursive: true });
  fs.writeFileSync(VERSE_CACHE, JSON.stringify(cache, null, 1));

  const usedSegs = [...new Set(messages.map(m => m.seg).filter(Boolean))];
  const segments = Object.fromEntries(usedSegs.map(k => [k, { ref: segs.get(k).ref, url: sefariaUrl(segs.get(k).ref), he: clean(segs.get(k).he) }]));
  const members = [...new Set(messages.flatMap(m => [m.from, m.forwardedFrom]).filter(Boolean))];
  const amudim = Object.values(source.amudim);

  const out = {
    masechet: slug, daf,
    title: `${masechet.name} ${daf}`,
    he: `${masechet.he} ${hebrewNumeral(daf)}`,
    description: content.description,
    topics: content.topics,
    members,
    sefaria: sefariaUrl(`${masechet.sefaria} ${daf}a`),
    attribution: `English: ${amudim[0].enVersion}. Aramaic: ${amudim[0].heVersion}. Commentaries: Sefaria (Vilna edition), English renderings by WhatsDaf.`,
    segments,
    messages,
  };
  const file = path.join(L.ROOT, 'data', slug, `${daf}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`built ${path.relative(L.ROOT, file)} (${messages.length} messages, ${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

// data/index.json lists every built daf with a one-line preview for the chat list.
function buildIndex() {
  const dafim = [];
  for (const m of MASECHTOT) {
    const dir = path.join(L.ROOT, 'data', m.slug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f))) {
      const d = L.readJSON(path.join(dir, f));
      const first = d.messages.find(x => x.kind === 'message' && x.from !== 'gemara') || d.messages.find(x => x.kind === 'message');
      const last = [...d.messages].reverse().find(x => x.kind === 'message');
      const plain = s => L.stripTags(s).replace(/\s+/g, ' ').trim().slice(0, 120);
      dafim.push({
        masechet: d.masechet, daf: d.daf, title: d.title, he: d.he,
        preview: { from: first.from, text: plain(first.text) },
        last: { from: last.from, text: plain(last.text) },
        messages: d.messages.filter(x => x.kind === 'message').length, members: d.members.length,
      });
    }
  }
  dafim.sort((a, b) => MASECHTOT.findIndex(m => m.slug === a.masechet) - MASECHTOT.findIndex(m => m.slug === b.masechet) || a.daf - b.daf);
  fs.writeFileSync(path.join(L.ROOT, 'data', 'index.json'), JSON.stringify({ dafim }, null, 1));
  console.log(`data/index.json: ${dafim.length} daf(im)`);
}

(async () => {
  const [slug, dafArg] = process.argv.slice(2);
  try {
    if (slug !== '--index') {
      if (!slug || !dafArg) { console.error('usage: node pipeline/build.js <masechet> <daf>'); process.exit(2); }
      await build(slug, +dafArg);
    }
    buildIndex();
  } catch (e) { console.error(e.message); process.exit(1); }
})();
