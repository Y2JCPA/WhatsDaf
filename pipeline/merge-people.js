#!/usr/bin/env node
/**
 * Fold staged people (content/<masechet>_<daf>.people.json) into data/people.json, append their
 * portrait prompts to portraits/PROMPTS.md under a new round heading, and delete the staged files.
 * Usage: node pipeline/merge-people.js "<round heading>" <masechet>_<daf> [...]
 *        (only the named dapim are merged, so dapim still being written keep their staged files)
 * An id that already exists in data/people.json is skipped (the existing entry wins) and reported.
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const [heading = 'New people', ...only] = process.argv.slice(2);
if (!only.length) { console.error('name the dapim to merge, e.g. bekhorot_53 bekhorot_54'); process.exit(2); }
const peopleFile = path.join(L.ROOT, 'data', 'people.json');
const data = L.readJSON(peopleFile);
const staged = fs.readdirSync(path.join(L.ROOT, 'content')).filter(f => f.endsWith('.people.json') && only.includes(f.replace('.people.json', ''))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const added = [];

for (const f of staged) {
  const file = path.join(L.ROOT, 'content', f);
  for (const [id, p] of Object.entries(L.readJSON(file).people || {})) {
    if (data.people[id]) { console.log(`skip ${id} (already in data/people.json) from ${f}`); continue; }
    const { prompt, ...entry } = p;
    data.people[id] = entry;
    added.push({ id, ...p, from: f.replace('.people.json', '') });
  }
  fs.unlinkSync(file);
}

// One person per line, as the file is written by hand.
const fields = p => Object.entries(p).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v).replace(/","/g, '", "')}`).join(', ');
const lines = Object.entries(data.people).map(([id, p]) => `    ${JSON.stringify(id)}: { ${fields(p)} }`);
fs.writeFileSync(peopleFile, `{\n  "_note": ${JSON.stringify(data._note)},\n  "people": {\n${lines.join(',\n')}\n  }\n}\n`);

if (added.length) {
  const rows = added.map(p => `| \`${p.image}\` | ${p.name}, ${p.era} | ${(p.prompt || p.bio).replace(/\|/g, '/')} |`);
  fs.appendFileSync(path.join(L.ROOT, 'portraits', 'PROMPTS.md'),
    `\n---\n\n## ${heading}\n\nSame output spec and shared style as above. Save to \`assets/portraits/<file>\`.\n\n| File | Person | Add to the shared style |\n|---|---|---|\n${rows.join('\n')}\n`);
}
console.log(`merged ${added.length} people from ${staged.length} file(s): ${added.map(p => p.id).join(', ')}`);
