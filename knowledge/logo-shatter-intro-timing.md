# פתיחת "הלוגו מתפזר" בשלב 2 - תזמון אחד משותף

`ZoomIntro mode="shatter"` מגדיר `SHATTER_AT = 0.7` שניות: באותו רגע הריבועים
של `FractalLogo` מתחילים לעוף (`shatterDelay`) וצליל `playShatter` מתנגן.
הלוגו לא נעצר לפני הפיצוץ: `logo-land` נמשך 2.6 שניות (כמו השכבה כולה)
ומגדיל אותו ברציפות מ-0.84 ל-1.12. הריבועים עפים ב-ease-out של 1.7 שניות עם
סיבוב מתון. מצב "zoom" (שלב 4) לא נגע.

sources:
- src/components/ZoomIntro.tsx
- src/components/FractalLogo.tsx
- src/styles/animations.css
