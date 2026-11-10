# LinguaTrail content approval checklist

All generated language files are draft content. Do not run the importer with
`--publish` until a fluent or native reviewer approves every item below.

## Per-language approval

- [ ] Reviewer name, language proficiency, region and review date recorded.
- [ ] All 25 target phrases are natural, current and appropriate for travellers.
- [ ] Every English meaning accurately represents the target phrase.
- [ ] Formality and politeness are consistent with the travel situation.
- [ ] Regional variants are identified and do not mix incompatible dialects.
- [ ] Romanization is readable and consistently formatted where present.
- [ ] Native script, punctuation, capitalization and diacritics are correct.
- [ ] Each question is unambiguous and has exactly one correct answer.
- [ ] The two distractors are plausible but clearly incorrect.
- [ ] Every explanation accurately describes when to use the phrase.
- [ ] Emergency, medical and police terminology receives a second review.
- [ ] Country mappings match the intended language variant.
- [ ] Optional audio is recorded by an appropriate speaker and matches the text.
- [ ] Content passes the dry-run validator before approval.

## Language-specific checks

### French (`fr.json`)

- [ ] Confirm metropolitan French wording, gender and polite register.
- [ ] Review liaison, silent letters and pronunciation guidance before adding audio.

### Spanish (`es.json`)

- [ ] Confirm the intended Spain variant and flag Latin-American differences.
- [ ] Review formal versus informal address.

### English (`en.json`)

- [ ] Confirm all questions are situation-based, not English-to-English translation.
- [ ] Confirm British English wording and identify globally understood alternatives.

### Italian (`it.json`)

- [ ] Confirm polite forms, articles and regional usage.

### Turkish (`tr.json`)

- [ ] Confirm vowel harmony, suffixes and polite register.

### German (`de.json`)

- [ ] Confirm noun capitalization, grammatical gender and formal address.

### Japanese (`ja.json`)

- [ ] Confirm kanji/kana, romaji and polite travel register.
- [ ] Confirm long vowels and punctuation are represented consistently.

### Thai (`th.json`)

- [ ] Confirm Thai script, tones and transliteration with a native speaker.
- [ ] Add speaker-gender polite particles where the situation requires them.

### Portuguese (`pt.json`)

- [ ] Confirm European Portuguese wording.
- [ ] Record Brazilian alternatives where materially different.
- [ ] Confirm speaker-gender forms such as `obrigado` and `obrigada`.

### Arabic (`ar.json`)

- [ ] Confirm right-to-left script rendering and Modern Standard Arabic wording.
- [ ] Identify where a local dialect is more useful than MSA for travellers.
- [ ] Confirm transliteration and pronunciation with a native speaker.

## Validation and approval record

Run before review:

```bash
node scripts/import-lingua-content.js --file content/lingua/fr.json
```

Repeat for every language. After approval, record:

| Code | Reviewer | Region | Review date | Emergency second review | Approved version |
| --- | --- | --- | --- | --- | --- |
| fr |  |  |  |  | 1 |
| es |  |  |  |  | 1 |
| en |  |  |  |  | 1 |
| it |  |  |  |  | 1 |
| tr |  |  |  |  | 1 |
| de |  |  |  |  | 1 |
| ja |  |  |  |  | 1 |
| th |  |  |  |  | 1 |
| pt |  |  |  |  | 1 |
| ar |  |  |  |  | 1 |
