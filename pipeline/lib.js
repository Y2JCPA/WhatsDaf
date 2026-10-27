// Shared helpers for validate.js and build.js.
const fs = require('fs');
const path = require('path');
const { MASECHTOT } = require('../js/masechtot');

const ROOT = path.join(__dirname, '..');
const COMMENTARY_TITLES = { rashi: 'Rashi', tosafot: 'Tosafot', gershom: 'Rabbeinu Gershom' };
const ALLOWED_TAGS = new Set(['b', 'i', 'br']);
// Bold words the chat may drop: the sender label already says who is speaking.
const DROPPABLE = new Set(['and']);
const SPEAKER_VERBS = ['says', 'said', 'say', 'comes', 'to', 'him', 'asked'];

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function loadDaf(slug, daf) {
  const masechet = MASECHTOT.find(m => m.slug === slug);
  if (!masechet) throw new Error(`unknown masechet ${slug}`);
  const sourceFile = path.join(__dirname, 'sources', `${slug}_${daf}.json`);
  if (!fs.existsSync(sourceFile)) throw new Error(`missing ${path.relative(ROOT, sourceFile)}; run: node pipeline/fetch-sefaria.js ${slug} ${daf}`);
  const notesFile = path.join(ROOT, 'content', `${slug}_${daf}.notes.json`);
  return {
    masechet,
    source: readJSON(sourceFile),
    content: readJSON(path.join(ROOT, 'content', `${slug}_${daf}.json`)),
    notes: fs.existsSync(notesFile) ? readJSON(notesFile) : {},
    people: readJSON(path.join(ROOT, 'data', 'people.json')).people,
  };
}

function decode(s) {
  return String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const stripTags = html => decode(String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''));

function words(html) {
  return stripTags(html).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’‘'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

// Every segment of the daf in order, keyed a1, a2 … b1 …
function segments(source) {
  const out = [];
  for (const [side, amud] of Object.entries(source.amudim)) {
    amud.en.forEach((en, i) => out.push({ key: `${side}${i + 1}`, ref: `${amud.ref}:${i + 1}`, en, he: amud.he[i] || '' }));
  }
  return out;
}

// Every commentary note on the daf, keyed rashi:a5.2 (commentary:amud segment.comment).
function commentaryNotes(source, slug) {
  const out = new Map();
  for (const [side, amud] of Object.entries(source.amudim)) {
    for (const [by, c] of Object.entries(amud.commentary || {})) {
      c.segments.forEach((comments, i) => comments.forEach((he, j) => {
        out.set(`${by}:${side}${i + 1}.${j + 1}`, { by, he, ref: `${c.title} on ${amud.ref}:${i + 1}:${j + 1}` });
      }));
    }
  }
  return out;
}

const boldWords = html => [...String(html).matchAll(/<b>([\s\S]*?)<\/b>/g)].flatMap(m => words(m[1]));

const expandMentions = (html, people) => String(html).replace(/@\{([\w-]+)\}/g, (_, id) => `@${people[id]?.name ?? id}`);

function speakerWords(id, people) {
  const p = people[id];
  if (!p) return [];
  return ['and', 'the', ...words(p.name), ...(p.say || []).flatMap(words), ...SPEAKER_VERBS];
}

// Indices of `a` that belong to a longest common subsequence of a and b.
function lcsMatched(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const hit = new Set();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { hit.add(i); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return hit;
}

// The words a reader gets from one message, in reading order: the quoted line it replies to,
// who sent it (the name stands in for "X says:"), the forwarded-from speaker, the subtitle,
// the lead line and the text.
function messageWords(msg, people) {
  return [
    ...words(msg.quote || ''),
    ...speakerWords(msg.from, people),
    ...(msg.forwardedFrom ? ['in', 'the', 'name', 'of', 'that', ...speakerWords(msg.forwardedFrom, people)] : []),
    ...words(msg.alt || ''),
    ...words(expandMentions(msg.lead || '', people)),
    ...speakerWords(msg.from, people), // a lead line can restate the source before the speaker's tag
    ...words(expandMentions(msg.text || '', people)),
  ];
}

function tagsIn(html) {
  return [...String(html).matchAll(/<\/?([a-zA-Z0-9]+)[^>]*>/g)].map(m => m[1].toLowerCase());
}

module.exports = {
  ROOT, COMMENTARY_TITLES, ALLOWED_TAGS, DROPPABLE, readJSON, loadDaf, stripTags, words, segments,
  commentaryNotes, boldWords, expandMentions, lcsMatched, messageWords, tagsIn,
};
