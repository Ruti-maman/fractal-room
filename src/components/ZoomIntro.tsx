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

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FractalLogo from "./FractalLogo";
import { playShatter } from "../lib/tapFeedback";

/**
 * mode="zoom" (ברירת מחדל, שלב 4) - הצלילה לתוך הלוגו.
 * mode="shatter" (שלב 2, בקשת הלקוחה 2026-11-08) - הלוגו נוחת, מחזיק רגע,
 * ו**מתפזר לריבועים** שעפים לכל הכיוונים ומגלים את המסך שמאחור.
 */
/** מתי הריבועים מתחילים לעוף (שניות) - גם התזמון של צליל ההתנפצות. */
const SHATTER_AT = 0.7;

function ZoomIntro({ mode = "zoom" }: { mode?: "zoom" | "shatter" }) {
  const [done, setDone] = useState(false);
  const shatter = mode === "shatter";

  // צליל ההתנפצות - בדיוק כשהריבועים מתחילים לעוף (בקשת הלקוחה)
  useEffect(() => {
    if (!shatter) return;
    const id = window.setTimeout(playShatter, SHATTER_AT * 1000);
    return () => window.clearTimeout(id);
  }, [shatter]);

  if (done) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
      style={{ animation: shatter ? "shatter-veil 2.6s var(--ds-ease) both" : "zoom-veil 2.4s var(--ds-ease) both" }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setDone(true);
      }}
    >
      {/* הלוגו של הלקוחה (בלי הרקע הכחול) במקום פרקטל העיגולים - לבקשתה */}
      {shatter ? (
        // אותו משך כמו השכבה כולה ועקומה כמעט לינארית: הלוגו לא נעצר אף רגע
        <span style={{ animation: "logo-land 2.6s cubic-bezier(0.25, 0.1, 0.4, 1) both" }}>
          <FractalLogo
            className="h-[min(70vh,80vw)] w-[min(70vh,80vw)] overflow-visible"
            shatter
            shatterDelay={SHATTER_AT}
          />
        </span>
      ) : (
        <FractalLogo
          className="h-[min(70vh,80vw)] w-[min(70vh,80vw)]"
          style={{ animation: "zoom-dive 2.4s cubic-bezier(0.7, 0, 0.84, 0) both" }}
        />
      )}
    </div>,
    document.body,
  );
}

export default ZoomIntro;
