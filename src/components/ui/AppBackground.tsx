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
import FractalLogo from "../FractalLogo";

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

/*
 * סמלי הלוגו הקטנים ברקע. פיזור על רשת 5×4 עם "רעידה" בתוך כל תא - כך הם
 * מכסים את כל המסך בלי להתקבץ, ובלי שייראו כמו טפט מסודר. לכל אחד גודל,
 * נטייה בסיסית, טווח נדנוד וקצב משלו, כדי שאף שניים לא יזוזו יחד.
 */
const EMBLEM_COLS = 5;
const EMBLEM_ROWS = 4;
const EMBLEMS = Array.from({ length: EMBLEM_COLS * EMBLEM_ROWS }, (_, i) => {
  const col = i % EMBLEM_COLS;
  const row = Math.floor(i / EMBLEM_COLS);
  const cellW = 100 / EMBLEM_COLS;
  const cellH = 100 / EMBLEM_ROWS;
  return {
    left: Math.round(col * cellW + 2 + seeded(i, 17.31) * (cellW - 10)),
    top: Math.round(row * cellH + 2 + seeded(i, 53.77) * (cellH - 12)),
    size: 5 + Math.round(seeded(i, 29.13) * 6), // vmin
    rot: Math.round(seeded(i, 61.9) * 50 - 25), // נטייה בסיסית
    // תנועה מורגשת כמו הכדורים המרחפים שהיו כאן קודם (בקשת הלקוחה,
    // 2026-11-11): הלוך-ושוב רך של 10-18 שניות לכיוון, עד כ-140px לרוחב
    // ו-160px לגובה, עם סיבוב קל של עד 7 מעלות לכל צד.
    sway: 4 + Math.round(seeded(i, 88.4) * 3),
    dx: Math.round(seeded(i, 72.4) * 280 - 140),
    dy: Math.round(seeded(i, 44.8) * 320 - 160),
    duration: 10 + Math.round(seeded(i, 33.3) * 8),
    // delay שלילי: כל סמל מתחיל באמצע המסלול שלו, לא כולם יחד מאפס
    delay: Math.round(seeded(i, 45.1) * 12),
  };
});

const STARS = Array.from({ length: 46 }, (_, i) => ({
  left: Math.round(seeded(i, 21.4) * 98) + 1,
  top: Math.round(seeded(i, 47.9) * 92) + 2,
  size: 1 + Math.round(seeded(i, 73.1) * 3),
  duration: 3 + Math.round(seeded(i, 11.7) * 5),
  delay: Math.round(seeded(i, 64.3) * 6),
  min: 0.08 + seeded(i, 39.5) * 0.12,
  max: 0.4 + seeded(i, 82.6) * 0.45,
}));

/**
 * סמלי הלוגו המרחפים. משמשים את הרקע הבהיר (BackgroundLayers), ומאז
 * 2026-11-12 גם את מסך "ברוכות הבאות" (Stage1OpeningBrand) - שם הם בלבן
 * ובקורל, כי .brand-trial קובע את --ds-brand-ink/coral ללבן ולאדום.
 * העיצוב והתנועה: .bg-emblem ב-background.css.
 */
export function FloatingEmblems() {
  return (
    <>
      {EMBLEMS.map((e, i) => (
        <span
          key={i}
          className="bg-emblem"
          style={{
            insetInlineStart: `${e.left}%`,
            top: `${e.top}%`,
            width: `${e.size}vmin`,
            ["--rot" as string]: `${e.rot}deg`,
            ["--sway" as string]: `${e.sway}deg`,
            ["--dx" as string]: `${e.dx}px`,
            ["--dy" as string]: `${e.dy}px`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${-e.delay}s`,
          }}
        >
          <FractalLogo emblemOnly className="bg-emblem__logo" />
        </span>
      ))}
    </>
  );
}

export function BackgroundLayers({ variant = "deep" }: Pick<Props, "variant">) {
  const quiet = variant === "quiet";
  const night = variant === "night";

  return (
    // bg-layers: בשפת "עיתונאי" (editorial-skin.css) כל השכבות כאן מוסתרות,
    // והרקע הופך לנייר עם רשת הקווים של מסך הפתיחה
    <div aria-hidden="true" className="bg-layers pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* כתמי אור גדולים - בכל האווירות, שקטים יותר במצב "quiet" */}
      <div className={cx("bg-aurora", quiet && "bg-aurora--calm")} />

      {/* זוהר שעולה מהאופק - פתיחה */}
      {variant === "dawn" && <div className="bg-dawn" />}

      {/*
        סמלי הלוגו הקטנים (בלי המילה "פרקטל") מפוזרים על כל הרקע, כל אחד
        בגודל, בנטייה ובקצב משלו, ומתנדנדים לאט - בקשת הלקוחה (2026-11-11).
        במצב הבהיר בלבד: ב-background.css הם מוסתרים במצב הכהה.
      */}
      <FloatingEmblems />

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
