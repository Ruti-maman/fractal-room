/*
 * ============================================================================
 *  רקע הדף
 * ============================================================================
 *
 *  לזכוכית אין משמעות בלי משהו מאחוריה - בלי הרקע הזה כל לבנה נראית כמו
 *  מלבן אפור. הרכיב מרכיב את השכבות; הן עצמן מוגדרות ב-styles/background.css,
 *  שם גם מתועד למה כל אחת בנויה כמו שהיא ומה נעשה בשביל הביצועים על
 *  הפלזמה.
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import Botanical from "./Botanical";

interface Props {
  /** תוכן הדף. יושב מעל הרקע בשכבה נפרדת. */
  children?: ReactNode;
  /** מוסיף ענף בוטני עדין בפינה. לא בכל מסך - רק במסכים שקטים. */
  botanical?: false | "lavender" | "fern" | "seagrass" | "sprig";
  className?: string;
}

/**
 * גרגרי האור הצפים. המיקום, הגודל והקצב קבועים ולא אקראיים בזמן ריצה,
 * אחרת הם "קופצים" למקום חדש בכל רינדור מחדש של הדף.
 *
 * תשעה בלבד: זה מספיק כדי שהחלל ירגיש חי, ומעט מספיק כדי שאף אחת
 * מהמשתתפות לא תתחיל לעקוב אחריהם במקום להקשיב לדיון.
 */
const MOTES = Array.from({ length: 9 }, (_, i) => {
  const rand = (seed: number) => (Math.sin((i + 1) * seed) + 1) / 2;
  return {
    left: Math.round(rand(12.9898) * 96) + 2,
    top: Math.round(rand(41.77) * 70) + 20,
    size: 2 + Math.round(rand(78.233) * 3),
    duration: 16 + Math.round(rand(93.1) * 16),
    delay: Math.round(rand(27.3) * 14),
  };
});

export function BackgroundLayers({ botanical = false }: Pick<Props, "botanical">) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 1. כתמי אור גדולים שנעים לאט */}
      <div className="bg-aurora" />

      {/* 2. אדוות - טבעות האור של אור שעובר במים */}
      <div className="bg-caustics" />

      {/* 3. קרני אור מלמעלה, כמו אור שנכנס מחלון */}
      <div className="bg-shafts" />

      {/* 4. רשת עדינה - מרקם שהזכוכית שוברת */}
      <div className="bg-grid" />

      {/* 5. גרגרי אור צפים */}
      {MOTES.map((mote, i) => (
        <span
          key={i}
          className="bg-mote"
          style={{
            insetInlineStart: `${mote.left}%`,
            top: `${mote.top}%`,
            width: mote.size,
            height: mote.size,
            animationDuration: `${mote.duration}s`,
            animationDelay: `${mote.delay}s`,
          }}
        />
      ))}

      {/* 6. הכהיית קצוות - ממקדת את העין פנימה */}
      <div className="bg-vignette" />

      {botanical && (
        <Botanical
          variant={botanical}
          size={360}
          className="text-accent absolute -bottom-16 -left-12 rotate-[8deg] opacity-[0.12]"
        />
      )}
    </div>
  );
}

/**
 * עטיפת מסך מלא. כל מסך בסדנה יושב בתוכה, כך שהרקע, הריווח הבסיסי
 * והמרכוז מוגדרים פעם אחת ולא בכל שלב מחדש.
 */
function AppBackground({ children, botanical = false, className }: Props) {
  return (
    <>
      <BackgroundLayers botanical={botanical} />
      <div className={cx("relative min-h-screen", className)}>{children}</div>
    </>
  );
}

export default AppBackground;
