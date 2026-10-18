/*
 * ============================================================================
 *  כניסת זום - "הגדלנו זום"
 * ============================================================================
 *
 *  במקום לכתוב על המסך "הגדלנו זום", המסך עושה את זה: פרקטל צבעוני
 *  (עיגול, ובו שישה עיגולים, ובכל אחד שישה קטנים יותר) ממלא את המסך,
 *  והמבט "צולל" לתוכו - הוא גדל פי כמה ונמוג, ומאחוריו מתגלה השלב,
 *  כאילו נחתנו על אחד מהחלקים שלו. זו בדיוק הרוח של "כלל הפרקטל": חלק
 *  קטן, אבל כבר רואים בו את השלם.
 *
 *  מוצג ב-portal ל-body: השלב עצמו מונפש ב-transform, ושכבה fixed בתוכו
 *  הייתה נמדדת ביחס אליו ולא לחלון (באג 6 ב-CLAUDE.md). לא חוסם נגיעות,
 *  ומתנקה לבד בסוף האנימציה. ב-prefers-reduced-motion האנימציות מתקצרות
 *  לרגע (animations.css), כך שהשכבה פשוט לא נראית.
 */

import { useState } from "react";
import { createPortal } from "react-dom";

const COLORS = [
  "var(--ds-bubble-1)",
  "var(--ds-bubble-2)",
  "var(--ds-bubble-3)",
  "var(--ds-bubble-4)",
  "var(--ds-bubble-5)",
  "var(--ds-bubble-1)",
];

/** עיגול ובו שישה עיגולים סביבו - ובכל אחד מהם (depth) עוד אותו דבר. */
function FractalRing({ cx, cy, r, depth }: { cx: number; cy: number; r: number; depth: number }) {
  const childR = r / 3;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={r * 0.02} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        const x = cx + Math.cos(a) * childR * 2;
        const y = cy + Math.sin(a) * childR * 2;
        return depth > 0 ? (
          <FractalRing key={i} cx={x} cy={y} r={childR} depth={depth - 1} />
        ) : (
          <circle key={i} cx={x} cy={y} r={childR * 0.82} fill={COLORS[i]} opacity={0.85} />
        );
      })}
      <circle cx={cx} cy={cy} r={childR * 0.82} fill="url(#zoom-core)" />
    </g>
  );
}

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
      <svg
        viewBox="-100 -100 200 200"
        className="text-accent h-[min(80vh,80vw)] w-[min(80vh,80vw)]"
        style={{ animation: "zoom-dive 2.4s cubic-bezier(0.7, 0, 0.84, 0) both" }}
      >
        <defs>
          <radialGradient id="zoom-core" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="var(--ds-bubble-3)" />
          </radialGradient>
        </defs>
        <FractalRing cx={0} cy={0} r={96} depth={2} />
      </svg>
    </div>,
    document.body,
  );
}

export default ZoomIntro;
