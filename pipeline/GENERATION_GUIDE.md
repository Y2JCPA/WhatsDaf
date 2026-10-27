# Writing a daf as a chat (content/<masechet>_<daf>.json)

Source: `pipeline/sources/<masechet>_<daf>.json` (run `node pipeline/fetch-sefaria.js <masechet> <daf>`).
It holds, per amud, the William Davidson English (`en`, with `<b>`/`<i>`), the vocalized Aramaic (`he`) and the
Hebrew of Rashi, Tosafot and Rabbeinu Gershom. Exemplar: `content/bekhorot_40.json`.

Check with `node pipeline/validate.js <masechet> <daf>`; build with `node pipeline/build.js <masechet> <daf>`.

## Rules

1. **The whole daf, near-verbatim.** Message text is the Davidson translation. Keep its `<b>` (the daf's own
   words) and `<i>` (transliterated terms). Split long passages into several messages, and drop connective phrases
   only when the chat already shows them ("The Gemara asks:" when the sender is the Gemara; "Rav Pappa says:" when
   the sender is Rav Pappa). Never paraphrase bold text. The validator checks that every bold word of every
   segment appears, in order, in that segment's messages.
2. **Who is talking.** The sender is the person whose words they are: `gemara` for the anonymous voice,
   `mishnah` for the mishna's anonymous voice, the named Tanna or Amora otherwise, `sages` for "the Sages / the Rabbis",
   `baraita` for an anonymous baraita. New people go in `data/people.json` (check that a same-named entry is really
   the same person; Rabbi Yehuda on most dapim is bar Ilai, not HaNasi), and their portrait prompt goes in `portraits/PROMPTS.md`.
3. **Mishna lines** get `"mishna": true` (gold bubble), even when a named Tanna is speaking inside the mishna.
4. **Quotes from elsewhere** are forwarded: `"forwarded": "Baraita"` or `"forwarded": "Niddah 21a"`. A statement
   passed on in someone's name ("Rabba bar bar Ḥana says that Rabbi Yoḥanan says") is `"from": "rabba-bar-bar-chana",
   "forwardedFrom": "rabbi-yochanan"`.
5. **Replies.** When the Gemara returns to a line of the mishna, or answers a specific statement, reply to it:
   `"replyTo": "<id>", "quote": "<the words being discussed>"`. The quote must come from the replied message.
6. **Addressing someone** ("Rabbi Akiva said to Rabbi Yoḥanan ben Nuri") is a mention: `@{yochanan-ben-nuri}`.
7. **Structure.** `{"kind": "divider", "text": "40b"}` at each amud; `{"kind": "section", "text": "Mishna"}` /
   `"Gemara"` at each new unit; `{"kind": "system", ...}` for stage directions (continued from the previous daf, a
   corrected version of the mishna, "raises an objection"); `"style": "refuted"` for a conclusive refutation.
8. **`lead`** is a small grey line above the text for the Davidson wording you cannot drop but that isn't the speaker's
   own words ("And Rabbi Akiva comes to say:", "It is taught in a baraita:"). **`alt`** is a subtitle beside the
   name ("and some say Rav Huna bar Natan", "The court that followed them").
9. **Verses.** Add `"verse": "Leviticus 22:23"` to the message that cites it; the build fetches the Hebrew and JPS English.
10. **Diagrams** only where a picture beats words: an original SVG in `assets/diagrams/<masechet>-<daf>-<slug>.svg`,
    added as `{"kind": "image", "src": ..., "caption": ...}`. Light background, readable at 400 px wide, no
    anatomical detail beyond a schematic.
11. **Every segment** gets a `"seg": "a5"` on each of its messages, in order. Every commentary note on the daf is attached to
    exactly one message with `"notes": ["rashi:a5.2", ...]`. Rashi's numbering follows the daf's segments;
    Rabbeinu Gershom's does not, so place each of his notes by its content.
12. **Commentary English** goes in `content/<masechet>_<daf>.notes.json`, keyed like the notes. Translate the Hebrew
    faithfully and plainly; put our clarifications in [square brackets]; say "(Rashi adds an Old French gloss)" rather
    than guessing at a gloss.
13. Write `description` (one sentence) and 5–8 `topics` (emoji + short line) for the group-info panel.

## Message fields

| field | meaning |
|---|---|
| `id` | optional; needed only if another message replies to this one |
| `from` | person id from `data/people.json` |
| `seg` | Sefaria segment, `a1` … `b18` |
| `text` | HTML: `<b>`, `<i>`, `<br>` only; `@{id}` for mentions |
| `mishna` | true for lines of the mishna |
| `forwarded` / `forwardedFrom` | label, or the person the sender is quoting |
| `replyTo` + `quote` | id of an earlier message and the words quoted from it |
| `lead`, `alt` | grey line above the text; subtitle beside the name |
| `verse` | a Tanakh reference for a link-preview card |
| `notes` | commentary keys attached to this message |
| `reactions` | e.g. `["👍"]`, sparingly |
