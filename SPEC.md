# WhatsDaf — spec (draft for review)

**The whole daf, as a group chat.**

WhatsDaf presents each daf of the Bavli as a WhatsApp-style group chat. The Tannaim and Amoraim
on the daf are the group members, the Gemara's anonymous voice is a member, the Mishnah is a member,
and the reader scrolls the conversation the way they would catch up on a busy group. The chat carries
the *full* text of the daf — not a summary — so someone can read the chat instead of the daf.

Siblings:
- **daf-yomi** (visual slides + quizzes per daf) — WhatsDaf reuses its Sefaria pipeline idea:
  fetch → content JSON → validate → build.
- **ChavalAlHaZman** (Torah personalities as a social feed) — WhatsDaf reuses its no-build static
  stack, Vercel hosting, localStorage preferences and portrait library.

Proof of concept: **Bekhorot 40** (Daf Yomi for Wed 28 Oct 2026 / 17 Cheshvan 5787).

---

## 1. Text and formatting

- **Source text:** Sefaria, *William Davidson Edition* (Koren/Steinsaltz English, CC BY-NC) and its
  vocalized Aramaic. Attribution shown in the app footer and the group info panel.
- **Fidelity:** message text is the Davidson translation, near-verbatim. Chat framing is allowed
  (who is speaking, replies, forwards, splitting long passages into several messages);
  paraphrase is not. Light trims of redundant connective phrases ("The Gemara asks:") are allowed
  only where the sender/reply structure already conveys them.
- **ArtScroll-style typography** — Sefaria already marks it up this way:
  - **Bold** = the literal translation of the words on the daf (Mishnah *and* Gemara).
  - Regular = the explanatory words woven in by the translator.
  - *Italics* = transliterated Hebrew/Aramaic terms (*baraita*, *tereifa*, *kasul*, *shaḥul*).
- **Completeness is enforced**, not hoped for: the validator checks that every bold phrase in
  Sefaria's English for both amudim appears, in order, in the chat (see §7).

## 2. Navigation (two-level chat list)

Desktop: list pane on the left, chat on the right (like WhatsApp Web). Mobile: list full-screen,
tap into a chat, back arrow returns.

**Level 1 — Masechtot.** Each masechet is a "chat" in the list:
- Avatar: masechet name in Hebrew on a colored circle (per-seder color).
- Title: `Bekhorot · בכורות`. Preview line: the opening line of the most recent daf.
  Right side: the Daf Yomi date of that daf, plus an unread badge (dapim not yet finished).
- Pinned at top: **Today's daf** (computed from the Daf Yomi calendar), which opens the daf directly.
- Masechtot with no dapim built yet are shown greyed ("Coming soon") or hidden — decide at build.

**Level 2 — Dapim.** Clicking a masechet swaps the list to that masechet's dapim (back arrow in the
list header returns to masechtot):
- Title: `Bekhorot 40`. Preview: first message. Right side: Daf Yomi date.
- Status ticks: ✓✓ blue = finished, ✓ grey = started, nothing = unread.

**Filter chips** (WhatsApp's All / Unread / Favorites / Groups, repurposed):
`All` · `Unread` (not finished) · `Starred` (saved messages) · `Today`.

**Search** ("Search or start a new chat"): searches masechet names, then message text within built dapim.

**Deep links:** `#/bekhorot/40` opens a daf; `#/bekhorot/40/m27` scrolls to and highlights a message.

## 3. The chat view

**Header:** group avatar, `Bekhorot 40 · בכורות מ׳`, and a subtitle listing members on the daf
("Gemara, Mishnah, Rabbi Akiva, Rabbi Yishmael, Rav Pappa…"). Tapping the header opens **Group info**:
members with portraits and one-line bios, topics on this daf, source attribution, link to the daf on Sefaria.

**Progress:** each daf is its own chat, so the native scrollbar shows how much is left. In addition:
- a thin progress bar under the header (percent of messages read) and the current amud (`40a` / `40b`);
- "↓ jump to where I left off" pill when reopening a daf mid-way (position saved locally).

**Wallpaper:** WhatsApp-like doodle pattern, but original — faint line icons of a daf, quill, lamp, scroll.

### Message types

| On the daf | In the chat |
|---|---|
| Named sage speaks | Message from that member: portrait, name in their color |
| Anonymous Gemara (asks/answers/objects) | Member **Gemara** |
| Mishnah | Member **Mishnah**, distinct bubble tint; each mishna is pinnable |
| Baraita / Tosefta quoted | **Forwarded** message (↪ *Forwarded* label), sender = the Tanna quoted or "Baraita" |
| Gemara returns to a mishna line | **Quote-reply** showing the quoted mishna message |
| Responds to an earlier statement | Quote-reply to that message |
| Verse from Tanach | Message with a **link-preview card** (verse, citation → Sefaria) |
| Amud change, new perek, new mishna | Grey **date pill** in the center: `40a`, `40b`, `Perek 6 · עַל אֵלּוּ מוּמִין` |
| Resolution / refutation / *teiku* | Centered **system notice** ("Rav Pappa's question stands unresolved — *teiku*") |
| Diagram | **Photo message** with caption (see §5) |
| Aside / tangent | Ordinary message, optionally replying to the message that sparked it |

Instead of a clock time, each bubble's corner shows its location: `40a`.
Reactions are used sparingly and only where meaningful (e.g. 👍 from the Gemara when an answer is accepted);
they are not decoration.

### Tapping a message — commentary bubble

Tapping (or clicking) any message opens a popover anchored to that bubble with tabs:

- **Rashi** · **Tosafot** · **Rabbeinu Gershom** (on Bekhorot) — only tabs that have notes on that segment.
  Each note shows the *dibbur hamatchil* in Hebrew, an English explanation, and **"Open on Sefaria ↗"**
  linking to the exact comment (e.g. `Rashi on Bekhorot 40a:5:2`).
- **Original** — the vocalized Aramaic/Hebrew of that segment.
- Actions: ⭐ Star message · 🔗 Copy link to message.

**Important:** Sefaria has Rashi, Tosafot and Rabbeinu Gershom on Bekhorot in **Hebrew only**. The English
in the bubble is *our* rendering of the Hebrew, written during content generation, and labeled
"WhatsDaf rendering — see original". This needs the same editorial review as the chat itself.
Rashi on Sefaria is already aligned to the daf's segments, so each note attaches to the right message.

## 4. The reader's own messages (green bubbles)

Green, right-aligned bubbles belong to the reader:
- **Notes:** a composer at the bottom ("Write a note…") adds a private note at the current point in the
  chat, saved in localStorage. Notes appear inline as green bubbles; replying to a sage's message is supported.
- **Finishing a daf:** scrolling to the end posts an automatic green bubble ("Finished Bekhorot 40 ✓✓"),
  and the daf gets its blue ticks in the list. A "Hadran" system notice on the last daf of a masechet.
- The 📎 attach and 🎤 mic icons are present for look but disabled (tooltip "coming soon"), or omitted.

Nothing is sent anywhere; all reader state is local to the browser, as in ChavalAlHaZman.

## 5. Images

- Diagrams are **original SVGs** drawn per daf (crisp at any size, small files, light/dark aware),
  stored in `assets/diagrams/<masechet>-<daf>-<slug>.svg`, shown as photo messages with captions.
  Tapping opens a full-screen viewer.
- Use one only where a picture beats words. Candidates for Bekhorot 40:
  1. The two cubit rods in the Shushan chamber vs. Moses' cubit (+½ fingerbreadth, +1 fingerbreadth).
  2. Fingerbreadth / handbreadth / cubit relationships.
  3. Schematic of the hip-joint conditions (*shaḥul*, *kasul*, *nishtarbeva*) — schematic, not anatomical.
- Expect roughly 1–4 diagrams per daf.

## 6. Portraits (profile pictures)

- **Reuse** ChavalAlHaZman portraits where the person is the same: Rabbi Akiva, Rabbi Meir,
  Rabbi Eliezer (ben Hyrcanus), Rabban Gamliel, Gemara (stam), "the Rabbis", Rav, Shmuel, Abaye, Rava, etc.
  Copied into this repo, not hot-linked.
- **Careful with names that look the same but aren't.** On Bekhorot 40, Rabbi Yehuda is *bar Ilai*
  (not HaNasi), Rabbi Yosei is *ben Ḥalafta* (not HaKohen), and Rabbi Yoḥanan is the Amora
  (not ben Zakkai). These need their own portraits.
- **New portraits needed for Bekhorot 40:** Rabbi Yishmael, Rabbi Yehuda (bar Ilai), Rabbi Yosei
  (ben Ḥalafta), Rabbi Yoḥanan (Amora), Rabbi Yoḥanan ben Nuri, Rabban Shimon ben Gamliel, Rabbi Ila,
  Rav Huna, Rav Huna bar Natan, Rav Pappa, Rav Yosef, Rav Naḥman bar Yitzḥak, plus a "Mishnah" and
  "Baraita" avatar.
- Style must match the existing set: painterly, warm candlelit beit-midrash backgrounds, head-and-shoulders,
  640×640. A prompt sheet (`portraits/PROMPTS.md`) gives one consistent prompt per person with
  identifying traits from the sources where known (e.g. Rav Yosef was blind; Rav Pappa a wealthy brewer).
- Until a portrait exists, the member gets a WhatsApp-style initials avatar in Hebrew (e.g. `ר״פ`)
  in their color — so a daf can ship before its portraits do.
- People registry `data/people.json`: id, English + Hebrew name, era (Tanna / Amora, generation,
  Eretz Yisrael / Bavel), one-line bio, color, image (optional). One entry per person, shared by all dapim.

## 7. Content pipeline

```
pipeline/
  fetch-sefaria.js   Sefaria → sources/<masechet>_<daf>.json  (English, Aramaic, Rashi, Tosafot, R. Gershom; gitignored)
  GENERATION_GUIDE.md  rules + schema for writing content/<masechet>_<daf>.json
  validate.js        schema + completeness + reference checks
  build.js           merges content + sources → data/<masechet>/<daf>.json (what the app loads)
content/             hand-authored chat JSON per daf (source of truth, committed)
data/                built JSON the app fetches (committed; Vercel serves it statically)
```

### Content schema (one daf)

```json
{
  "masechet": "bekhorot", "daf": 40,
  "members": ["gemara", "mishnah", "akiva", "yishmael", "rav-pappa"],
  "messages": [
    { "id": "m1", "kind": "divider", "text": "40a" },
    { "id": "m2", "from": "mishnah", "ref": "Bekhorot 40a:5", "text": "<b>…</b> …" },
    { "id": "m3", "from": "gemara", "ref": "Bekhorot 40a:6", "replyTo": "m2", "text": "…" },
    { "id": "m4", "from": "baraita", "forwarded": true, "ref": "Bekhorot 40a:7", "text": "…" },
    { "id": "m5", "from": "gemara", "ref": "Bekhorot 40a:9", "verse": { "ref": "Leviticus 12:2", "text": "…" }, "text": "…" },
    { "id": "m6", "kind": "image", "src": "assets/diagrams/bekhorot-40-cubits.svg", "caption": "…", "ref": "Bekhorot 40a:1" },
    { "id": "m7", "kind": "system", "text": "…" }
  ],
  "commentary": {
    "Bekhorot 40a:5": [
      { "by": "rashi", "ref": "Rashi on Bekhorot 40a:5:2", "dh": "שני כיסין", "en": "…" }
    ]
  }
}
```

`ref` ties a message to a Sefaria segment. A segment may be split across several messages; `build.js`
attaches the segment's Aramaic and commentary to the first message of that segment.

### Validator rules
1. Only this daf and masechet; refs exist and are in range (pagination table shared with daf-yomi).
2. **Coverage:** every segment of both amudim is referenced, in order; every bold phrase in the Sefaria
   English appears in the concatenated message text (normalized for whitespace/punctuation).
3. Every `from` is in `people.json`; every `replyTo` points to an earlier message; every image file exists.
4. Every Rashi/Tosafot/R. Gershom note on the daf is attached to some segment (none dropped silently).
5. Allowed inline HTML only: `<b>`, `<i>`, `<span class="he">`, `<br>`.

## 8. Stack and deployment

- Static HTML/CSS/JS, no build step to *run* the site (`python3 -m http.server`). Node scripts only in the
  content pipeline.
- Vercel, same as ChavalAlHaZman; Vercel Insights snippet; Jacob Bros badge like the sister sites.
- Original "WhatsDaf" logo and name; layout and color language are WhatsApp-like, but no WhatsApp logo or trademarked icon.
- Light and dark themes (WhatsApp has both; `prefers-color-scheme` plus a toggle).
- Hebrew text `dir="rtl"` with a Hebrew-capable serif (Frank Ruhl Libre, already used by ChavalAlHaZman).

## 9. Proof-of-concept scope (Bekhorot 40)

1. App shell: two-level list, chat view, header, group info, progress, commentary popover, notes, stars,
   deep links, mobile layout, dark mode.
2. Pipeline: fetch, validate, build — run end-to-end on Bekhorot 40.
3. Content: the whole of Bekhorot 40a–40b as chat (~4,000 words, 42 segments, ~14 named sages),
   Rashi/Tosafot/R. Gershom in the commentary bubble, 2–3 diagrams.
4. Portraits: reused where possible, initials for the rest, plus `portraits/PROMPTS.md` for the new ones.
5. Bekhorot shows only daf 40 as available; other masechtot appear as "coming soon".

## 10. Editorial note

Chat framing and commentary renderings are WhatsDaf's own and need a second-pass review by a qualified
reader before public promotion, as with ChavalAlHaZman. The app always links to the source on Sefaria.

## Open items
- [ ] New portraits: who generates them, and with which tool (the ChavalAlHaZman set looks AI-generated).
- [ ] Coming-soon masechtot: show greyed, or hide until built?
- [ ] Domain / Vercel project name.
