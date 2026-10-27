#!/usr/bin/env node
/**
 * Validate content/<masechet>_<daf>.json against its Sefaria source.
 * Usage: node pipeline/validate.js <masechet> <daf>
 * Exit code 1 on any error. Warnings (e.g. a portrait not generated yet) do not fail.
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib');

function validate(slug, daf) {
  const errors = [], warnings = [];
  const { masechet, source, content, notes, people } = L.loadDaf(slug, daf);
  const err = m => errors.push(m), warn = m => warnings.push(m);

  if (content.masechet !== slug || content.daf !== daf) err(`content says ${content.masechet} ${content.daf}, expected ${slug} ${daf}`);
  if (daf < masechet.first || daf > masechet.last) err(`${masechet.name} has dapim ${masechet.first}-${masechet.last}; ${daf} is out of range`);

  const segs = L.segments(source);
  const segIndex = new Map(segs.map((s, i) => [s.key, i]));
  const allNotes = L.commentaryNotes(source, slug);
  const msgs = content.messages;
  const ids = new Map();
  const assigned = new Map();
  let lastSeg = -1;

  msgs.forEach((m, i) => {
    const where = `message ${i + 1}${m.id ? ` (${m.id})` : ''}`;
    const kind = m.kind || 'message';
    if (!['message', 'system', 'divider', 'section', 'image'].includes(kind)) err(`${where}: unknown kind ${kind}`);
    if (m.id) { if (ids.has(m.id)) err(`${where}: duplicate id`); ids.set(m.id, m); }

    for (const field of ['text', 'lead', 'quote', 'alt', 'caption']) {
      for (const tag of L.tagsIn(m[field] || '')) if (!L.ALLOWED_TAGS.has(tag)) err(`${where}: <${tag}> is not allowed in ${field}`);
    }
    for (const [, id] of String(m.text || '').matchAll(/@\{([\w-]+)\}/g)) if (!people[id]) err(`${where}: mention of unknown person ${id}`);

    if (m.seg !== undefined) {
      if (!segIndex.has(m.seg)) err(`${where}: no segment ${m.seg} on this daf`);
      else if (segIndex.get(m.seg) < lastSeg) err(`${where}: segment ${m.seg} is out of order`);
      else lastSeg = segIndex.get(m.seg);
    }

    if (kind === 'message') {
      if (!people[m.from]) err(`${where}: unknown sender ${m.from}`);
      if (!m.seg) err(`${where}: every message needs a seg`);
      if (!m.text) err(`${where}: empty text`);
      if (m.forwardedFrom && !people[m.forwardedFrom]) err(`${where}: unknown forwardedFrom ${m.forwardedFrom}`);
      if (m.verse && !/^[A-Z][A-Za-z ]+ \d+:\d+(-\d+)?$/.test(m.verse)) err(`${where}: verse should look like "Leviticus 22:23"`);
      if (m.replyTo) {
        const target = ids.get(m.replyTo);
        if (!target) err(`${where}: replyTo ${m.replyTo} is not an earlier message id`);
        else if (m.quote) {
          const q = L.words(m.quote).filter(w => w !== 'or');
          const hit = L.lcsMatched(q, L.words(L.expandMentions(target.text, people))).size;
          if (q.length && hit / q.length < 0.6) err(`${where}: quote "${m.quote}" does not match ${m.replyTo}`);
        }
      }
    }
    if (kind === 'image') {
      if (!m.src || !fs.existsSync(path.join(L.ROOT, m.src))) err(`${where}: image ${m.src} not found`);
      if (!m.caption) err(`${where}: image needs a caption`);
    }
    for (const key of m.notes || []) {
      if (!allNotes.has(key)) err(`${where}: no commentary note ${key} in the source`);
      else if (assigned.has(key)) err(`${where}: note ${key} already attached to message ${assigned.get(key)}`);
      assigned.set(key, i + 1);
      if (!notes[key]) err(`${where}: note ${key} has no English rendering in content/${slug}_${daf}.notes.json`);
    }
  });

  for (const key of allNotes.keys()) if (!assigned.has(key)) err(`commentary note ${key} is not attached to any message`);
  for (const key of Object.keys(notes)) if (!key.startsWith('_') && !allNotes.has(key)) err(`notes.json has ${key}, which is not in the source`);

  // Completeness: every bold word of every segment appears, in order, in that segment's messages.
  let totalBold = 0, totalMissing = 0;
  for (const seg of segs) {
    const segMsgs = msgs.filter(m => m.seg === seg.key);
    if (!segMsgs.length) { err(`segment ${seg.key} (${seg.ref}) is not in the chat`); continue; }
    const bold = L.boldWords(seg.en);
    const chat = segMsgs.flatMap(m => L.messageWords(m, people));
    const hit = L.lcsMatched(bold, chat);
    totalBold += bold.length;
    const missing = bold.map((w, i) => (hit.has(i) || L.DROPPABLE.has(w) ? null : i)).filter(i => i !== null);
    totalMissing += missing.length;
    if (missing.length) {
      const show = missing.map(i => `"${bold.slice(Math.max(0, i - 3), i).join(' ')} [${bold[i]}] ${bold.slice(i + 1, i + 4).join(' ')}"`);
      err(`segment ${seg.key}: ${missing.length} bold word(s) missing: ${show.join('; ')}`);
    }
  }

  const used = new Set(msgs.flatMap(m => [m.from, m.forwardedFrom]).filter(Boolean));
  for (const id of used) {
    const img = people[id]?.image;
    if (img && !fs.existsSync(path.join(L.ROOT, 'assets', 'portraits', img))) warn(`portrait not generated yet: assets/portraits/${img} (${people[id].name})`);
  }

  return { errors, warnings, stats: { messages: msgs.length, segments: segs.length, boldWords: totalBold, missing: totalMissing, notes: allNotes.size } };
}

if (require.main === module) {
  const [slug, dafArg] = process.argv.slice(2);
  if (!slug || !dafArg) { console.error('usage: node pipeline/validate.js <masechet> <daf>'); process.exit(2); }
  const { errors, warnings, stats } = validate(slug, +dafArg);
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`${slug} ${dafArg}: ${stats.messages} messages, ${stats.segments} segments, ${stats.boldWords - stats.missing}/${stats.boldWords} bold words covered, ${stats.notes} commentary notes — ${errors.length ? `${errors.length} error(s)` : 'ok'}`);
  process.exit(errors.length ? 1 : 0);
}

module.exports = { validate };
