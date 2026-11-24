import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePortalHost } from "../lib/portalHost";
import type { Tip } from "./TipPopups";

/*
 * ============================================================================
 *  פופ-אפ טיפים לשם הקבוצה (שלב 2) - בשפת "עיתונאי" (2026-11-12)
 * ============================================================================
 *
 *  דרישת הלקוחה מהאפיון: "שיקפצו חלוניות פופאפ" עם ההוראות - ברור, מובן,
 *  חוויתי וחדשני. עד 2026-11-12 זה היה חלון זכוכית עם "מסלול שלבים" של
 *  מעוינים צבעוניים על שביל מקווקו. עכשיו - כמו כל מסכי ההזדהות - בשפה
 *  הטיפוגרפית מההשראה של הלקוחה:
 *
 *   - **עמוד כחול מלא** נפרש מלמעלה, עם קווי רשת לבנים (בעמוד כחול מלא כן
 *     שמים קווים - knowledge/grid-lines-on-color-blocks.md).
 *   - **הטיפים יושבים בדיוק בעמודות הרשת**, ובכל אחד מספר ענק ודק שמתגלגל
 *     פנימה כמו מונה - הניגוד בין ענק לזעיר.
 *   - **"זרקור" שעובר בין הטיפים** (בקשת המפתחת: "יותר עניין ותזוזה"):
 *     העמודה הפעילה מתמלאת בלבן והטקסט מתהפך לכחול - בלוק הפוך, כמו
 *     בגלריה בהשראה - וריבוע אדום מחליק לאורך הקו העליון אליה. כך התנועה
 *     גם מובילה את הקריאה: טיפ אחד בכל פעם. נגיעה בטיפ מעבירה אליו את הזרקור.
 *
 *  כפתור אחד בלבד - "הבנו, בואו נבחר שם!" (בלי "סגירה" ובלי ×, שעשו אותו
 *  דבר - דרישת הלקוחה). CSS: .tp-* ב-styles/editorial.css.
 */

/** כמה זמן הזרקור נשאר על כל טיפ */
const SPOT_MS = 2600;
/** מתי הזרקור מתחיל - אחרי שכל העמודות נכנסו */
const SPOT_START_MS = 1700;
/** משך היציאה - תואם ל-.tp-page.is-leaving ב-editorial.css */
const LEAVE_MS = 1150;

function TipBubbles({
  open,
  onClose,
  title,
  tips,
  confirmLabel = "הבנו, בואו נבחר שם!",
  displayOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tips: Tip[];
  /** הכפתור היחיד בפופ-אפ. */
  confirmLabel?: string;
  /**
   * תצוגה בלבד - למסך הגדול (/screen/4, 2026-11-19, בקשת הלקוחה "את המסך
   * הזה על המסך הגדול"): בלי כפתור, בלי מיקוד ובלי Escape. הזרקור רץ לבד.
   */
  displayOnly?: boolean;
}) {
  const host = usePortalHost();
  const btnRef = useRef<HTMLButtonElement>(null);
  /**
   * יציאה (בקשת המפתחת, 2026-11-12: "שיזוז בצורה יפה, שייעלם בצורה
   * מעניינת"): הכפתור נלחץ ונורה לכיוון החץ שלו ↙, העמודות נאספות למעלה
   * אחת-אחת, והעמוד הכחול כולו מתגלגל למעלה כמו וילון וחושף את המסך. רק
   * בסוף - onClose.
   */
  const [leaving, setLeaving] = useState(false);
  const leaveRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  function leave() {
    if (leaveRef.current) return;
    leaveRef.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      leaveRef.current = false;
      setLeaving(false);
      onCloseRef.current();
    }, LEAVE_MS);
  }
  /** הטיפ שעליו הזרקור (-1 = עוד לא התחיל) */
  const [active, setActive] = useState(-1);
  /** מתחלף בכל נגיעה - מאתחל את הספירה, כדי שהזרקור לא יקפוץ מיד הלאה */
  const [tick, setTick] = useState(0);

  // המיקוד עובר לכפתור היחיד, ו-Escape סוגר - כמו בחלון רגיל
  useEffect(() => {
    if (!open || displayOnly) return;
    btnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // leave יציבה מספיק: היא קוראת רק ל-refs ול-setState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // הזרקור: מתחיל אחרי הכניסה, ועובר טיפ-טיפ בלולאה
  useEffect(() => {
    if (!open || tips.length === 0) {
      setActive(-1);
      return;
    }
    const first = window.setTimeout(
      () => setActive((a) => (a < 0 ? 0 : a)),
      tick === 0 ? SPOT_START_MS : 0,
    );
    const loop = window.setInterval(() => setActive((a) => (a + 1) % tips.length), SPOT_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
    };
  }, [open, tips.length, tick]);

  if (!open) return null;

  return createPortal(
    <div
      className={`tp-page ${leaving ? "is-leaving" : ""}`}
      role={displayOnly ? undefined : "dialog"}
      aria-modal={displayOnly ? undefined : "true"}
      aria-labelledby="tp-title"
    >
      <h2 id="tp-title" className="tp-title">
        <span className="tp-title__square" aria-hidden="true" />
        {title}
      </h2>

      {/* (חץ ↙ דק וענק בפינה הריקה - הוסר לבקשת המפתחת, 2026-11-12) */}

      {/* האלמנט הזכיר של המסך ("עוד עניין", 2026-11-12): שם הטיפ שעליו
          הזרקור, ענק ועבה, בשתי העמודות הריקות משמאל. מתחלף עם הזרקור -
          המילה החדשה עולה מתוך הקו התחתון של הרשת. הטיפוגרפיה עצמה היא
          הקישוט, בלי שום צורה נוספת. */}
      <div className="tp-word" aria-hidden="true">
        {active >= 0 && tips[active] && (
          <span key={active} className="tp-word__in">
            {tips[active].title}
          </span>
        )}
      </div>

      <ol className="tp-tips" style={{ "--tp-active": Math.max(0, active) } as CSSProperties}>
        {/* הריבוע האדום שמחליק לאורך הקו העליון אל הטיפ הפעיל */}
        <span className={`tp-marker ${active >= 0 ? "is-on" : ""}`} aria-hidden="true" />
        {tips.map((tip, i) => (
          <li
            key={tip.title}
            className={`tp-tip ${i === active ? "is-active" : ""}`}
            style={{ "--tp-i": i } as CSSProperties}
            onPointerDown={() => {
              // במסך הגדול - בלי אינטראקציה (האפיון), הזרקור רץ לבד
              if (displayOnly) return;
              setActive(i);
              setTick((n) => n + 1);
            }}
          >
            {/* המספר מתגלגל מ-00 אל המספר שלו, כמו מונה */}
            <span className="tp-tip__num" aria-hidden="true">
              <span className="tp-roll">
                <span>00</span>
                <span>{String(i + 1).padStart(2, "0")}</span>
              </span>
            </span>
            <span className="tp-tip__title">{tip.title}</span>
            <span className="tp-tip__text">{tip.text}</span>
          </li>
        ))}
      </ol>

      <div className="tp-foot" hidden={displayOnly}>
        <button ref={btnRef} type="button" className="bt-btn ed-btn tp-btn" onClick={leave}>
          <span className="bt-btn__label">
            {confirmLabel}
            <svg viewBox="0 0 24 24" className="ed-btn__arrow" aria-hidden="true">
              <path
                d="M19 5 L5 19 M5 8 L5 19 L16 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        </button>
      </div>
    </div>,
    host,
  );
}

export default TipBubbles;
