# חלון הטיפים לדיון משתמש ברקע של האתר עצמו

`.chat-surface` צובע את חלון ה-GlassModal באותו גרדיאנט `--ds-bg-from/via/to`
של המסך - כהה במצב הכהה וקרם במצב הבהיר. ברק הזכוכית והמסגרת (`::before`,
`::after`) כבויים, כי במצב הבהיר יצרו כתם לבן עכור. הבועות תמיד לבנות, ולכן
הטקסט בתוכן מקבל `--chat-ink` (נייבי) ולא `text-ink`, שבמצב הכהה כמעט לבן.
לפני כן נוסו ונפסלו: נייבי מנוקד, קרם, נייבי חלק.

sources:
- src/styles/glass.css
- src/components/TipChat.tsx
- src/styles/tokens.css
