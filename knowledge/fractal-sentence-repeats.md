# "כלל הפרקטל" נבנה שלוש פעמים, וכל המופע כ-17.6 שניות

ל-`FractalSentence` במצב `once` יש `repeats`: נבנה (2.2ש'), מחזיק (1.8ש'),
מתפרק (1.5ש') ונבנה שוב; רק אחרי הבנייה האחרונה מחזיק 3.2ש' וקורא `onDone`.
`onceTotalMs` מחשב את המשך. `FractalFullscreen` (שלבים 2 ו-6) מעביר
`repeats={3}` ו-`onBuildStart={playSparkle}`, כך שהנצנוץ נשמע בתחילת כל בנייה.
בדיקה אוטומטית שמחכה פחות מ-~20 שניות תסתיים לפני שהמסך עובר הלאה.

sources:
- src/components/FractalSentence.tsx
- src/components/FractalFullscreen.tsx
