# כפתור "חזרה לשלב הקודם" יושב בשכבה משלו מעל כל מסך מלא

הסרגל העליון הוא `fixed z-40`, ומסכים מלאים יושבים מעליו: ההזדהות בשלב 2
(`z-[45]`), "כלל הפרקטל" (`z-[70]`), סרטון מלא. לכן `TopBar` מציג את כפתור
החזרה ומתג התצוגה ב-portal ל-body ב-`z-[75]`, ובתוך הסרגל משאיר עותק
`invisible` באותו גודל כדי שהמרכז לא יזוז. ילד בתוך הסרגל לא יכול לעבור את
z-40 שלו. הכפתור לא מוצג בשלב 1 (`canGoBack` ב-StageRouter).

sources:
- src/components/TopBar.tsx
- src/components/StageRouter.tsx
- src/pages/ScreenPage.tsx
- src/components/FractalFullscreen.tsx
- src/components/stages/Stage2Identification.tsx
