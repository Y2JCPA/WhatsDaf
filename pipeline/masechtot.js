// Bavli masechtot in Daf Yomi order. first/last are the real first and last daf;
// endsOnA marks tractates whose final daf has no amud b on Sefaria.
// Shared by the pipeline (Node) and the app (browser, via window.MASECHTOT).
(function (root) {
  const MASECHTOT = [
    ['berakhot', 'Berakhot', 'ברכות', 'Berakhot', 'zeraim', 2, 64],
    ['shabbat', 'Shabbat', 'שבת', 'Shabbat', 'moed', 2, 157],
    ['eruvin', 'Eruvin', 'עירובין', 'Eruvin', 'moed', 2, 105],
    ['pesachim', 'Pesachim', 'פסחים', 'Pesachim', 'moed', 2, 121],
    ['shekalim', 'Shekalim', 'שקלים', 'Shekalim', 'moed', 2, 22],
    ['yoma', 'Yoma', 'יומא', 'Yoma', 'moed', 2, 88],
    ['sukkah', 'Sukkah', 'סוכה', 'Sukkah', 'moed', 2, 56],
    ['beitzah', 'Beitzah', 'ביצה', 'Beitzah', 'moed', 2, 40],
    ['rosh-hashanah', 'Rosh Hashanah', 'ראש השנה', 'Rosh Hashanah', 'moed', 2, 35],
    ['taanit', 'Taanit', 'תענית', 'Taanit', 'moed', 2, 31],
    ['megillah', 'Megillah', 'מגילה', 'Megillah', 'moed', 2, 32],
    ['moed-katan', 'Moed Katan', 'מועד קטן', 'Moed Katan', 'moed', 2, 29],
    ['chagigah', 'Chagigah', 'חגיגה', 'Chagigah', 'moed', 2, 27],
    ['yevamot', 'Yevamot', 'יבמות', 'Yevamot', 'nashim', 2, 122],
    ['ketubot', 'Ketubot', 'כתובות', 'Ketubot', 'nashim', 2, 112],
    ['nedarim', 'Nedarim', 'נדרים', 'Nedarim', 'nashim', 2, 91],
    ['nazir', 'Nazir', 'נזיר', 'Nazir', 'nashim', 2, 66],
    ['sotah', 'Sotah', 'סוטה', 'Sotah', 'nashim', 2, 49],
    ['gittin', 'Gittin', 'גיטין', 'Gittin', 'nashim', 2, 90],
    ['kiddushin', 'Kiddushin', 'קידושין', 'Kiddushin', 'nashim', 2, 82],
    ['bava-kamma', 'Bava Kamma', 'בבא קמא', 'Bava Kamma', 'nezikin', 2, 119],
    ['bava-metzia', 'Bava Metzia', 'בבא מציעא', 'Bava Metzia', 'nezikin', 2, 119],
    ['bava-batra', 'Bava Batra', 'בבא בתרא', 'Bava Batra', 'nezikin', 2, 176],
    ['sanhedrin', 'Sanhedrin', 'סנהדרין', 'Sanhedrin', 'nezikin', 2, 113],
    ['makkot', 'Makkot', 'מכות', 'Makkot', 'nezikin', 2, 24],
    ['shevuot', 'Shevuot', 'שבועות', 'Shevuot', 'nezikin', 2, 49],
    ['avodah-zarah', 'Avodah Zarah', 'עבודה זרה', 'Avodah Zarah', 'nezikin', 2, 76],
    ['horayot', 'Horayot', 'הוריות', 'Horayot', 'nezikin', 2, 14],
    ['zevachim', 'Zevachim', 'זבחים', 'Zevachim', 'kodashim', 2, 120],
    ['menachot', 'Menachot', 'מנחות', 'Menachot', 'kodashim', 2, 110],
    ['chullin', 'Chullin', 'חולין', 'Chullin', 'kodashim', 2, 142],
    ['bekhorot', 'Bekhorot', 'בכורות', 'Bekhorot', 'kodashim', 2, 61],
    ['arakhin', 'Arakhin', 'ערכין', 'Arakhin', 'kodashim', 2, 34],
    ['temurah', 'Temurah', 'תמורה', 'Temurah', 'kodashim', 2, 34],
    ['keritot', 'Keritot', 'כריתות', 'Keritot', 'kodashim', 2, 28],
    ['meilah', 'Meilah', 'מעילה', 'Meilah', 'kodashim', 2, 22],
    ['kinnim', 'Kinnim', 'קינים', 'Kinnim', 'kodashim', 23, 25],
    ['tamid', 'Tamid', 'תמיד', 'Tamid', 'kodashim', 26, 33],
    ['middot', 'Middot', 'מדות', 'Middot', 'kodashim', 34, 37],
    ['niddah', 'Niddah', 'נדה', 'Niddah', 'taharot', 2, 73],
  ].map(([slug, name, he, sefaria, seder, first, last]) => ({ slug, name, he, sefaria, seder, first, last }));

  // Kinnim and Tamid start mid-daf (22b, 25b); the Daf Yomi calendar gives them their next full daf.
  // Daf Yomi cycle 14 began with Berakhot 2 on 5 January 2020; one daf per day through all of the above.
  const CYCLE_START = Date.UTC(2020, 0, 5);
  const CYCLE_LENGTH = MASECHTOT.reduce((n, m) => n + m.last - m.first + 1, 0);

  function dafYomiFor(date) {
    const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - CYCLE_START) / 864e5);
    let n = ((day % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
    for (const m of MASECHTOT) {
      const count = m.last - m.first + 1;
      if (n < count) return { masechet: m.slug, daf: m.first + n };
      n -= count;
    }
  }

  // The civil date a given daf is learned in the cycle that contains `near` (defaults to today).
  function dateForDaf(slug, daf, near = new Date()) {
    let offset = 0;
    for (const m of MASECHTOT) {
      if (m.slug === slug) { offset += daf - m.first; break; }
      offset += m.last - m.first + 1;
    }
    const today = Math.floor((Date.UTC(near.getFullYear(), near.getMonth(), near.getDate()) - CYCLE_START) / 864e5);
    const cycle = Math.floor(today / CYCLE_LENGTH);
    return new Date(CYCLE_START + (cycle * CYCLE_LENGTH + offset) * 864e5);
  }

  const api = { MASECHTOT, dafYomiFor, dateForDaf, CYCLE_LENGTH };
  if (typeof module !== 'undefined') module.exports = api; else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
