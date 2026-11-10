# LinguaTrail reviewed content

One JSON file is required per language. Content is accepted only after human
review of translations, pronunciation guidance, regional wording, questions,
answers, and explanations.

Required shape:

- One supported language and optional `defaultCountryCodes`.
- Exactly five lessons: `GREETINGS`, `TRANSPORT`, `HOTEL`, `FOOD`, `HELP`.
- Exactly five phrases per lesson.
- Exactly one question per phrase.
- Exactly three options and one correct option per question.
- English uses `SITUATION_TO_PHRASE` questions only.
- Audio is optional and references an existing public `media.assets` UUID.

Validate without writing:

```bash
node scripts/import-lingua-content.js --file content/lingua/fr.json
```

Import or replace draft versions:

```bash
node scripts/import-lingua-content.js \
  --file content/lingua/fr.json \
  --apply
```

Publish reviewed content explicitly:

```bash
node scripts/import-lingua-content.js \
  --file content/lingua/fr.json \
  --apply \
  --publish
```

Published lesson versions are immutable. Further edits require a higher
lesson `version` in the source file.

## Generated draft set

The current `fr`, `es`, `en`, `it`, `tr`, `de`, `ja`, `th`, `pt`, and `ar`
files are unpublished drafts derived from the reviewed starter rows in the
LinguaTrail master workbook. Regenerate them consistently with:

```bash
node content/lingua/generate-drafts.mjs
```

Generation does not write to the database. Complete
`REVIEW_CHECKLIST.md` before importing with `--publish`. Until that approval
exists, use dry-run validation only.
