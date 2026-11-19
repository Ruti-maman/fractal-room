# "כלל הפרקטל" נבנה פעם אחת, וכל המופע כ-7.2 שניות

ל-`FractalSentence` במצב `once` יש `repeats`; `FractalFullscreen` (שלבים 2 ו-6)
מעביר `repeats={1}` (2026-11-11, הלקוחה: "שיהיה פעם אחת"; עד אז 3). המופע:
שדה זורם 1.8ש' (`ONCE_SWIRL_MS`), בנייה 2.2ש', החזקה 3.2ש' - ואז `onDone`.
`onceTotalMs` מחשב את המשך; עם `repeats` גדול מ-1 נוספים בין בנייה לבנייה
החזקה 1.8ש' ופירוק 1.5ש'. `onBuildStart={playSparkle}` - נצנוץ בתחילת הבנייה.
בדיקה אוטומטית שמחכה פחות מ-~8 שניות תסתיים לפני שהמסך עובר הלאה.

sources:
- src/components/FractalSentence.tsx
- src/components/FractalFullscreen.tsx
