/*
 * ============================================================================
 *  משוב מגע כמו מקלדת הנעילה של האייפון (בקשת הלקוחה, 2026-11-11)
 * ============================================================================
 *
 *  ברגע הנגיעה - לא בשחרור - קורים שני דברים:
 *   1. **עיגול עגול ונקי מתחת לאצבע** נדלק מיד, בגובה הכפתור (כך הוא נשאר
 *      עיגול שלם ולא נחתך). הוא **נשאר כל עוד מחזיקים**, ובשחרור מתרחב
 *      מעט ונמוג ברכות - בדיוק כמו ספרה במקלדת הנעילה.
 *   2. **הכפתור שוקע** (`pressed` -> מחלקה `is-pressed`) - מחלקה שלנו ולא
 *      :active, שבחלק מדפדפני המגע נדלק באיחור או בכלל לא.
 *
 *  צבע העיגול הוא צבע הטקסט של הכפתור (currentColor): לבן על כפתור אדום,
 *  נייבי על כפתור זכוכית. העיצוב: `.tap-ripple*` ב-glass.css.
 *
 *  שימוש: `spawn` ב-onPointerDown, `release` ב-onPointerUp/Cancel/Leave,
 *  ו-`layer` כילד ראשון של הכפתור (שצריך position: relative). את התוכן
 *  של הכפתור כדאי לשים מעל השכבה (position: relative + z-index).
 *
 *  משמש את GlassButton/GlassIconButton (Glass.tsx) ואת כפתור "התחילו" של
 *  מסך הפתיחה (Stage1OpeningBrand.tsx).
 *
 *  ה-timeouts לא מנוקים בכוונה: setState על רכיב שכבר ירד הוא no-op ב-React
 *  18+, והעיגול ממילא נעלם יחד עם הכפתור.
 */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cx } from "../../lib/cx";

interface Ripple {
  id: number;
  x: number;
  y: number;
  /** קוטר העיגול - בגובה הכפתור, כדי שיישאר עיגול שלם */
  d: number;
  out: boolean;
}

/** אם השחרור לא הגיע (אצבע שגלשה החוצה בדפדפן ישן) - העיגול נמוג בכל זאת */
const RIPPLE_MAX_MS = 2500;
/** תואם ל-tap-release ב-animations.css */
const RIPPLE_FADE_MS = 480;

export function useTapRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [pressed, setPressed] = useState(false);
  const nextId = useRef(0);

  const fadeOut = useCallback((id?: number) => {
    setRipples((current) => current.map((r) => (id === undefined || r.id === id ? { ...r, out: true } : r)));
    window.setTimeout(
      () => setRipples((current) => current.filter((r) => !(r.out && (id === undefined || r.id === id)))),
      RIPPLE_FADE_MS,
    );
  }, []);

  const spawn = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // עיגול בגובה הכפתור; המרכז מוזז פנימה אם נגעו קרוב לקצה, כדי שלא
      // ייחתך מלמעלה או מלמטה
      const d = Math.min(rect.height * 0.92, rect.width * 0.92, 120);
      const r = d / 2;
      const x = Math.min(Math.max(e.clientX - rect.left, r), rect.width - r);
      const y = Math.min(Math.max(e.clientY - rect.top, r), rect.height - r);
      const id = nextId.current++;
      setRipples((current) => [...current, { id, x, y, d, out: false }]);
      setPressed(true);
      window.setTimeout(() => fadeOut(id), RIPPLE_MAX_MS);
    },
    [fadeOut],
  );

  /** האצבע הורמה / יצאה / בוטלה */
  const release = useCallback(() => {
    setPressed(false);
    fadeOut();
  }, [fadeOut]);

  const layer =
    ripples.length > 0 ? (
      <span className="tap-ripples" aria-hidden="true">
        {ripples.map((r) => (
          <span
            key={r.id}
            className={cx("tap-ripple", r.out && "tap-ripple--out")}
            style={{ left: r.x, top: r.y, width: r.d, height: r.d }}
          >
            <span className="tap-ripple__wave" />
          </span>
        ))}
      </span>
    ) : null;

  return { spawn, release, pressed, layer };
}
