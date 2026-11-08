/*
 * ============================================================================
 *  כניסת זום - "הגדלנו זום"
 * ============================================================================
 *
 *  במקום לכתוב על המסך "הגדלנו זום", המסך עושה את זה: הלוגו של פרקטל
 *  (עץ הריבועים - בעצמו פרקטל) ממלא את המסך, והמבט "צולל" לתוכו - הוא
 *  גדל פי כמה ונמוג, ומאחוריו מתגלה השלב. (עד 2026-10-25 היה כאן פרקטל
 *  של עיגולים; הלקוחה ביקשה את הלוגו במקומו.)
 *
 *  מוצג ב-portal ל-body: השלב עצמו מונפש ב-transform, ושכבה fixed בתוכו
 *  הייתה נמדדת ביחס אליו ולא לחלון (באג 6 ב-CLAUDE.md). לא חוסם נגיעות,
 *  ומתנקה לבד בסוף האנימציה. ב-prefers-reduced-motion האנימציות מתקצרות
 *  לרגע (animations.css), כך שהשכבה פשוט לא נראית.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import FractalLogo from "./FractalLogo";

function ZoomIntro() {
  const [done, setDone] = useState(false);
  if (done) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
      style={{ animation: "zoom-veil 2.4s var(--ds-ease) both" }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setDone(true);
      }}
    >
      {/* הלוגו של הלקוחה (בלי הרקע הכחול) במקום פרקטל העיגולים - לבקשתה */}
      <FractalLogo
        className="h-[min(70vh,80vw)] w-[min(70vh,80vw)]"
        style={{ animation: "zoom-dive 2.4s cubic-bezier(0.7, 0, 0.84, 0) both" }}
      />
    </div>,
    document.body,
  );
}

export default ZoomIntro;
