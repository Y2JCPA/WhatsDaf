# WhatsDaf

**The whole daf, as a group chat.**

WhatsDaf shows each daf of the Bavli as a WhatsApp-style group chat. The Tannaim and Amoraim on the daf are the
members, the Gemara asks and answers, the Mishna's lines are tinted gold, and quoted baraitot arrive as forwarded
messages. The chat carries the complete text of the daf, so you can read it instead of the daf.

- Pick a masechet, then a daf. Today's Daf Yomi is pinned at the top.
- Tap any message for Rashi, Tosafot and Rabbeinu Gershom (Hebrew, an English rendering, and a link to Sefaria) or
  the original Aramaic.
- The scrollbar and the green progress bar show how much of the daf is left; reaching the end marks it finished ✓✓.
- Star lines and write your own notes as green bubbles. Everything you do stays in your browser.

Proof of concept: **Bekhorot 40** (Daf Yomi, 28 October 2026). See [SPEC.md](SPEC.md) for the full design.

## Run locally

No build step:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>. (Opening `index.html` as a file won't load the dapim.)

## Adding a daf

```bash
node pipeline/fetch-sefaria.js bekhorot 41      # Sefaria text + commentaries → pipeline/sources/ (gitignored)
# write content/bekhorot_41.json and content/bekhorot_41.notes.json per pipeline/GENERATION_GUIDE.md
node pipeline/validate.js bekhorot 41           # must end in "ok"
node pipeline/build.js bekhorot 41              # → data/bekhorot/41.json and data/index.json
```

The validator refuses a daf that leaves out any bold word of the Gemara, drops a commentary note, quotes a message
that doesn't say what the quote claims, or names someone who isn't in `data/people.json`.

## Structure

- `index.html`, `css/app.css`, `js/app.js` — the app (plain HTML/CSS/JS)
- `js/masechtot.js` — masechet table and Daf Yomi calendar, shared by the app and the pipeline
- `data/people.json` — every chat member: name, Hebrew, era, bio, colour, portrait
- `data/index.json`, `data/<masechet>/<daf>.json` — built output the app loads
- `content/` — the hand-written chat for each daf and its commentary renderings (source of truth)
- `pipeline/` — fetch, validate, build, and the generation guide
- `assets/portraits/` — profile pictures; anyone without one shows Hebrew initials
- `assets/diagrams/` — original SVG diagrams posted in the chats
- `portraits/PROMPTS.md` — image prompts for the portraits still needed

## Sources and credits

- English and Aramaic: *The William Davidson Talmud* (Koren–Steinsaltz), CC BY-NC, via [Sefaria](https://www.sefaria.org).
- Rashi, Tosafot, Rabbeinu Gershom: Hebrew from Sefaria; English renderings by WhatsDaf.
- Verse cards: Hebrew Tanakh and the JPS translation via Sefaria.
- Portraits are imaginative illustrations, several shared with [ChavalAlHaZman](https://github.com/Y2JCPA/chavalalhazman).

## Disclaimer

A learning project. The chat framing and the commentary renderings are WhatsDaf's own and need review by a qualified
reader. Always check the source, and ask a qualified authority for practical halakha.
