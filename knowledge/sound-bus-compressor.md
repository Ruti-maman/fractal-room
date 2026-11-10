# צלילי המעבר יוצאים דרך מדחס, הגברה והד משותף

כל צלילי המעבר והמצב (playWhoosh, playPop, playShatter, playChime, playSuccess,
playSparkle) עוברים דרך `getBus()`: DynamicsCompressor (סף -16dB, יחס 8)
ואחריו הגברה פי 2.2. המדחס הוא מה שמאפשר עוצמה גבוהה בלי עיוות כשכמה צלילים
נופלים יחד. צלילים "דרמטיים" נשלחים גם ל-`getEcho()` - השהיה של 0.21 שניות
עם משוב 0.38 ומסנן lowpass, כמו אולם. `playTap` (הטיק של כל נגיעה) לא עובר
בערוץ הזה ונשאר רך.

sources:
- src/lib/tapFeedback.ts
- src/components/StageTransition.tsx
