/*
 * ============================================================================
 *  רקע הדף
 * ============================================================================
 *
 *  לזכוכית אין משמעות בלי משהו מאחוריה - בלי הרקע הזה כל לבנה נראית כמו
 *  מלבן אפור. הרכיב מרכיב את השכבות; הן עצמן מוגדרות ב-styles/background.css,
 *  שם גם מתועד למה כל אחת בנויה כמו שהיא ומה נעשה בשביל הביצועים על
 *  הפלזמה.
 *
 *  ----------------------------------------------------------------------
 *  למה לכל שלב רקע משלו
 *  ----------------------------------------------------------------------
 *  עשרה מסכים עם רקע זהה מרגישים כמו עשר פעמים אותו מסך. כאן לכל שלב יש
 *  **אווירה** משלו מאותה פלטה ומאותו חומר: מסך הפתיחה מקבל אור עולה,
 *  שמש האסוציאציות מקבלת קרניים שיוצאות מהמרכז, מסך הסימון מקבל שקט כדי
 *  שהדף יהיה הגיבור, ומסך הסיום מקבל לילה. המעבר בין שלבים מרגיש כמו
 *  תנועה בתוך אותו חלל, לא כמו קפיצה לאתר אחר.
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import LightTrails from "./LightTrails";

/**
 * האווירות האפשריות.
 *  deep      - ברירת המחדל: מים עמוקים עם אדוות אור.
 *  dawn      - אור שעולה מלמטה, גרגרים רבים. לפתיחה.
 *  ripple    - דגש על האדוות. למסכי הזדהות והמתנה.
 *  radiant   - קרניים שיוצאות ממרכז המסך. לשמש האסוציאציות.
 *  quiet     - כמעט ריק. למסכים שבהם התוכן צריך את כל תשומת הלב.
 *  tide      - גלי אור אופקיים שזורמים. לדיון ולפתרונות.
 *  night     - שדה כוכבים מנצנץ. לחגיגה ולסיום.
 */
export type BackgroundVariant =
  | "deep"
  | "dawn"
  | "ripple"
  | "radiant"
  | "quiet"
  | "tide"
  | "night";

interface Props {
  children?: ReactNode;
  variant?: BackgroundVariant;
  className?: string;
}

/** מחולל ערכים קבועים - אותו "אקראי" בכל רינדור, כדי שהחלקיקים לא יקפצו. */
function seeded(i: number, seed: number) {
  return (Math.sin((i + 1) * seed) + 1) / 2;
}

const MOTES = Array.from({ length: 12 }, (_, i) => ({
  left: Math.round(seeded(i, 12.9898) * 96) + 2,
  top: Math.round(seeded(i, 41.77) * 70) + 20,
  size: 2 + Math.round(seeded(i, 78.233) * 3),
  duration: 16 + Math.round(seeded(i, 93.1) * 16),
  delay: Math.round(seeded(i, 27.3) * 14),
}));

/*
 * הכדורים המרחפים (ORBS) והבועות העולות (BUBBLES) שהיו כאן הוסרו מכל
 * הפרויקט לבקשת הלקוחה (2026-10-25). הרקע נשען עכשיו על כתמי האור,
 * שבילי האור, וגרגרי האור הזעירים.
 */

const STARS = Array.from({ length: 46 }, (_, i) => ({
  left: Math.round(seeded(i, 21.4) * 98) + 1,
  top: Math.round(seeded(i, 47.9) * 92) + 2,
  size: 1 + Math.round(seeded(i, 73.1) * 3),
  duration: 3 + Math.round(seeded(i, 11.7) * 5),
  delay: Math.round(seeded(i, 64.3) * 6),
  min: 0.08 + seeded(i, 39.5) * 0.12,
  max: 0.4 + seeded(i, 82.6) * 0.45,
}));

export function BackgroundLayers({ variant = "deep" }: Pick<Props, "variant">) {
  const quiet = variant === "quiet";
  const night = variant === "night";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* כתמי אור גדולים - בכל האווירות, שקטים יותר במצב "quiet" */}
      <div className={cx("bg-aurora", quiet && "bg-aurora--calm")} />

      {/* זוהר שעולה מהאופק - פתיחה */}
      {variant === "dawn" && <div className="bg-dawn" />}

      {/*
        שבילי האור - המרקם המרכזי של הרקע, בכל האווירות.
        החליפו גם את האדוות (שנקראו כמטרה) וגם את הרשת (שנקראה כנייר
        משבצות): שתיהן היו דוגמאות שחוזרות על עצמן, וזה בדיוק מה שהורג
        תחושת חלל. ראו LightTrails.tsx.
      */}
      <div className={cx("absolute inset-0", quiet && "opacity-40")}>
        <LightTrails />
      </div>

      {/* קרניים שיוצאות מהמרכז - שמש האסוציאציות */}
      {variant === "radiant" && <div className="bg-rays" />}

      {/* זוהר רחב שנודד לאורך הדף */}
      {variant === "tide" && <div className="bg-drift" />}

      {/* קרני אור מלמעלה */}
      {(variant === "deep" || variant === "dawn") && <div className="bg-shafts" />}

      {/* שדה כוכבים - חגיגה וסיום */}
      {night &&
        STARS.map((star, i) => (
          <span
            key={i}
            className="bg-star"
            style={{
              insetInlineStart: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              boxShadow: `0 0 ${star.size * 3}px ${star.size / 2}px var(--ds-glow-soft)`,
              ["--star-min" as string]: star.min,
              ["--star-max" as string]: star.max,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}

      {/* גרגרי אור צפים - הכי הרבה בפתיחה, בכלל לא במסך שקט */}
      {!quiet &&
        MOTES.slice(0, variant === "dawn" ? MOTES.length : 7).map((mote, i) => (
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

      {/* אין יותר כדורים/בועות מרחפים ברקע - הוסרו מכל הפרויקט לבקשת הלקוחה */}

      {/* הכהיית קצוות - ממקדת את העין פנימה */}
      <div className="bg-vignette" />

    </div>
  );
}

/**
 * עטיפת מסך מלא. כל מסך בסדנה יושב בתוכה, כך שהרקע, הריווח הבסיסי
 * והמרכוז מוגדרים פעם אחת ולא בכל שלב מחדש.
 */
function AppBackground({ children, variant, className }: Props) {
  return (
    <>
      <BackgroundLayers variant={variant} />
      <div className={cx("relative min-h-screen", className)}>{children}</div>
    </>
  );
}

export default AppBackground;
