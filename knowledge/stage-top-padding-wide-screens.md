# במסך רחב התוכן מתחיל 24px מלמעלה, כמו הריווח התחתון

`StageShell` משתמש ב-`pt-20` אבל `lg:pt-6` - ב-lg ומעלה הסרגל העליון תופס רק
את שתי הפינות, אז אין צורך ברצועה עליונה שלמה. `lg:pt-6` שווה ל-`lg:pb-6` של
`tightBottom`, כך שבדף הפתיחה של שלב 3 הרווח למעלה ולמטה זהה (נמדד: 24/24).
שלבים 7 ו-8 בונים `<main>` משלהם, ושם `lg:pt-*` הושווה ל-`pb-*` של כל אחד.

sources:
- src/components/StageShell.tsx
- src/components/StageIntro.tsx
- src/components/stages/Stage7Simulation.tsx
- src/components/stages/Stage8Winner.tsx
