/*
 * ============================================================================
 *  כפתור "התחילו" של מסך הפתיחה - מקש כמו בביטול הנעילה באייפון
 * ============================================================================
 *
 *  הוצא מ-Stage1OpeningBrand (2026-11-12), כדי ששתי גרסאות מסך הפתיחה
 *  ("שפת הלוגו" ו"עיתונאי") ישתמשו באותה התנהגות בדיוק. ההחלטות, כולן
 *  בקשות הלקוחה מ-2026-11-11:
 *    - במנוחה: "נושם" (bt-breathe) - גדל וקטן לאט, כהזמנה לגעת.
 *    - בנגיעה: מתכווץ, עיגול שקוף נדלק סביב האצבע וגדל, "טוק" ורטט.
 *    - בשחרור: גדל **מעבר** לגודל הרגיל, חוזר מעט פנימה ומתיישב; העיגול
 *      מתרחב עוד מעט ונמוג.
 *    - בלי עיגול לבן "מוזנח" ובלי סימן מגע מצויר מתחת לכפתור.
 *
 *  הגדילה דרך Web Animations ולא דרך מחלקה: כך כל לחיצה מתחילה את הקפיצה
 *  מחדש, גם בלחיצות מהירות, בלי להרכיב את הכפתור מחדש (מה שהיה מאבד את
 *  ה-click). דפדפן בלי element.animate מקבל את ההתכווצות מ-:active בלבד.
 *
 *  העיצוב (.bt-btn, .bt-glow, .bt-breathe) ב-brand-trial.css; הצבעים מ-
 *  --bt-coral / --bt-white של העוטף. כל גרסה יכולה להוסיף className משלה.
 */

import { useRef, useState, type ReactNode } from "react";
import { buzz, playKeyClick } from "../lib/tapFeedback";

interface Props {
  onStart: () => void;
  children: ReactNode;
  /** מחלקה נוספת לכפתור עצמו (צורה/צבע של גרסה מסוימת) */
  className?: string;
  /** "נשימה" במנוחה. false = כפתור שקט (גרסת "עיתונאי", 2026-11-12) */
  breathe?: boolean;
}

function StartKeyButton({ onStart, children, className, breathe = true }: Props) {
  const [pressed, setPressed] = useState(false);
  const [glow, setGlow] = useState<{ id: number; x: number; y: number; d: number; out: boolean } | null>(null);
  const glowId = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const motion = useRef<Animation | null>(null);
  // אם הצליל לא נשמע בנגיעה (דפדפן מגע שמאשר קול רק בהרמת האצבע) - בשחרור
  const clickPending = useRef(false);

  function animateKey(frames: Keyframe[], duration: number) {
    const el = btnRef.current;
    if (!el?.animate) return;
    // ממשיכים מהגודל הנוכחי, כדי שלא תהיה קפיצה בתחילת התנועה
    const from = getComputedStyle(el).transform;
    motion.current?.cancel();
    motion.current = el.animate([{ transform: from === "none" ? "scale(1)" : from }, ...frames], {
      duration,
      fill: "forwards",
    });
  }

  function glowOut() {
    setGlow((g) => (g ? { ...g, out: true } : g));
    const id = glowId.current;
    // תואם ל-bt-glow-out ב-brand-trial.css
    window.setTimeout(() => setGlow((g) => (g && g.id === id ? null : g)), 460);
  }

  function pressDown(e: React.PointerEvent<HTMLButtonElement>) {
    // המיקום נמדד לפני ההתכווצות, ביחידות של הכפתור בגודלו הרגיל
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const k = el.offsetWidth / rect.width || 1;
    glowId.current += 1;
    setGlow({
      id: glowId.current,
      x: (e.clientX - rect.left) * k,
      y: (e.clientY - rect.top) * k,
      d: el.offsetHeight * 2.6,
      out: false,
    });
    setPressed(true);
    animateKey([{ transform: "scale(0.86)", easing: "ease-out" }], 110);
    clickPending.current = !playKeyClick();
    buzz();
  }

  function pressUp() {
    setPressed(false);
    glowOut();
    // מעבר לגודל הרגיל, חזרה קלה פנימה, והתיישבות
    animateKey(
      [
        { transform: "scale(1.16)", offset: 0.42, easing: "ease-in-out" },
        { transform: "scale(0.97)", offset: 0.72, easing: "ease-in-out" },
        { transform: "scale(1)" },
      ],
      560,
    );
    if (clickPending.current) {
      clickPending.current = false;
      playKeyClick();
    }
  }

  function pressCancel() {
    if (!pressed) return;
    setPressed(false);
    glowOut();
    animateKey([{ transform: "scale(1)", easing: "ease-out" }], 200);
  }

  return (
    // "נשימה" בעוטף משלה: לכפתור כבר יש את ההתכווצות בלחיצה. נעצרת בזמן הלחיצה.
    <div className={breathe ? `bt-breathe ${pressed ? "is-paused" : ""}` : undefined}>
      <button
        ref={btnRef}
        type="button"
        // יש לו עיגול משלו (bt-glow) - בלי הזוהר הכללי של TouchGlow
        data-no-glow
        className={`bt-btn ${pressed ? "is-pressed" : ""} ${className ?? ""}`}
        onClick={onStart}
        onPointerDown={pressDown}
        onPointerUp={pressUp}
        onPointerCancel={pressCancel}
        onPointerLeave={pressCancel}
      >
        {glow && (
          <span
            key={glow.id}
            aria-hidden="true"
            className={`bt-glow ${glow.out ? "bt-glow--out" : ""}`}
            style={{ left: glow.x, top: glow.y, width: glow.d, height: glow.d }}
          />
        )}
        {/* התוכן מעל העיגול השקוף, כדי שיישאר חד */}
        <span className="bt-btn__label">{children}</span>
      </button>
    </div>
  );
}

export default StartKeyButton;
