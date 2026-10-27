#!/usr/bin/env node
/**
 * Fetch one daf (amud a + b) from Sefaria with its commentaries, keeping the translation's
 * <b>/<i> markup (bold = words of the daf, italics = transliterated terms).
 * Usage: node pipeline/fetch-sefaria.js <masechet-slug> <daf> [<daf> ...]   (or <slug> <from>-<to>)
 * Output: pipeline/sources/<slug>_<daf>.json  (gitignored; regenerate any time)
 */
const fs = require('fs');
const path = require('path');
const { MASECHTOT } = require('../js/masechtot');

const COMMENTARIES = [
  ['rashi', 'Rashi'],
  ['tosafot', 'Tosafot'],
  ['gershom', 'Rabbeinu Gershom'],
];

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'whatsdaf-pipeline' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
  }
}

async function version(ref, lang) {
  const j = await getJSON(`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${lang}`);
  if (!j || j.error || !j.versions?.length) return null;
  const v = j.versions[0];
  return { text: v.text, versionTitle: v.versionTitle, license: v.license };
}

async function fetchAmud(sefariaName, amudRef) {
  const ref = `${sefariaName} ${amudRef}`;
  const en = await version(ref, 'english');
  const he = await version(ref, 'hebrew');
  if (!en) return null;
  const commentary = {};
  for (const [key, title] of COMMENTARIES) {
    const c = await version(`${title} on ${ref}`, 'hebrew');
    // Commentary text is [segment][comment]; normalise missing segments to [].
    if (c) commentary[key] = { title, versionTitle: c.versionTitle, segments: c.text.map(s => Array.isArray(s) ? s : s ? [s] : []) };
  }
  return {
    ref,
    en: en.text, he: he ? he.text : [],
    enVersion: `${en.versionTitle} (${en.license})`, heVersion: he ? `${he.versionTitle} (${he.license})` : null,
    commentary,
  };
}

async function main() {
  const [slug, ...rest] = process.argv.slice(2);
  const m = MASECHTOT.find(x => x.slug === slug);
  if (!m) { console.error('Unknown masechet slug', slug); process.exit(1); }
  const dafim = [];
  for (const r of rest) {
    const range = r.match(/^(\d+)-(\d+)$/);
    if (range) for (let d = +range[1]; d <= +range[2]; d++) dafim.push(d); else dafim.push(+r);
  }
  const outDir = path.join(__dirname, 'sources');
  fs.mkdirSync(outDir, { recursive: true });
  for (const daf of dafim) {
    const amudim = {};
    for (const side of ['a', 'b']) {
      if (daf === m.last && side === 'b' && m.endsOnA) continue;
      const a = await fetchAmud(m.sefaria, `${daf}${side}`);
      if (a) amudim[side] = a;
    }
    if (!Object.keys(amudim).length) { console.error(`FAILED ${slug} ${daf}: no text`); continue; }
    const out = path.join(outDir, `${slug}_${daf}.json`);
    fs.writeFileSync(out, JSON.stringify({ masechet: slug, daf, amudim }, null, 1));
    const segs = Object.values(amudim).map(a => a.en.length).join('+');
    const notes = Object.values(amudim).flatMap(a => Object.entries(a.commentary).map(([k, c]) => `${k}:${c.segments.flat().length}`));
    console.log(`fetched ${slug} ${daf}: ${segs} segments; ${notes.join(' ')}`);
  }
}
main();
