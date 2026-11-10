# כל המסגרות מרובעות דרך טוקן אחד

ב-`tokens.css` כל `--ds-r-xs..2xl` שווים ל-`--ds-r-btn` (4px), וגם
`--radius-3xl/4xl` של Tailwind ממופים אליו. לכן כרטיסים, פופ-אפים, שדות ותגיות
מרובעים בלי לגעת בכל רכיב. `.glass-input`, `.glass-chip`, `.glass-pill`
ו-`.slot-input` הוגדרו במפורש כ-`--ds-r-btn`. `rounded-full` / `--ds-r-full`
נשארים רק לעיגולים אמיתיים: נקודות, הילות, אדוות, פסי התקדמות.

sources:
- src/styles/tokens.css
- src/styles/glass.css
- src/components/stages/Stage7Simulation.tsx
- src/components/ClipPlayer.tsx
- CLAUDE.md
