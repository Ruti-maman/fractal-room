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
import Botanical from "./Botanical";

/**
 * האווירות האפשריות.
 *  deep      - ברירת המחדל: מים עמוקים עם אדוות אור.
 *  dawn      - אור שעולה מלמטה, גרגרים רבים. לפתיחה.
 *  ripple    - דגש על האדוות והבועות. למסכי הזדהות והמתנה.
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

type BotanicalVariant = "lavender" | "fern" | "seagrass" | "sprig";

interface Props {
  children?: ReactNode;
  botanical?: false | BotanicalVariant;
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

const BUBBLES = Array.from({ length: 10 }, (_, i) => ({
  left: Math.round(seeded(i, 33.7) * 92) + 4,
  size: 8 + Math.round(seeded(i, 61.3) * 26),
  duration: 22 + Math.round(seeded(i, 17.9) * 20),
  delay: Math.round(seeded(i, 55.1) * 24),
  sway: Math.round(seeded(i, 88.2) * 60 - 30),
}));

/*
 * לבנים מרחפות. כל אחת בעומק אחר (`depth`: 0 רחוק, 1 קרוב), וזה מה
 * ששולט בגודל, בחדות, בעוצמת הצל ובשקיפות - כך שהן נקראות כחלל עם
 * עומק ולא כאוסף ריבועים על רקע.
 *
 * מעט מאוד מהן (7), והן יושבות בשוליים: הן אמורות להיות משהו שמרגישים
 * בפריפריה, לא משהו שמסתכלים עליו במקום על התוכן.
 */
const ORBS = Array.from({ length: 7 }, (_, i) => {
  const depth = 0.18 + seeded(i, 51.3) * 0.8;
  return {
    depth,
    // מרוכזות בשוליים הימניים והשמאליים, רחוק ממרכז המסך
    left: i % 2 === 0 ? 2 + seeded(i, 19.1) * 16 : 82 + seeded(i, 23.7) * 15,
    top: 8 + seeded(i, 67.5) * 78,
    size: Math.round(26 + depth * 76),
    duration: 14 + Math.round(seeded(i, 88.9) * 14),
    delay: Math.round(seeded(i, 35.2) * 10),
    dx: Math.round(seeded(i, 72.4) * 34 - 17),
    dy: -(18 + Math.round(seeded(i, 44.8) * 30)),
    spinFrom: Math.round(seeded(i, 15.6) * 16 - 8),
    spinTo: Math.round(seeded(i, 91.2) * 18 - 6),
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

export function BackgroundLayers({
  botanical = false,
  variant = "deep",
}: Pick<Props, "botanical" | "variant">) {
  const quiet = variant === "quiet";
  const night = variant === "night";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* כתמי אור גדולים - בכל האווירות, שקטים יותר במצב "quiet" */}
      <div className={cx("bg-aurora", quiet && "bg-aurora--calm")} />

      {/* זוהר שעולה מהאופק - פתיחה */}
      {variant === "dawn" && <div className="bg-dawn" />}

      {/* אדוות - בכל האווירות חוץ מ-quiet, חזקות יותר ב-ripple */}
      {!quiet && !night && (
        <div className={cx("bg-caustics", variant !== "ripple" && "bg-caustics--soft")} />
      )}

      {/* קרניים שיוצאות מהמרכז - שמש האסוציאציות */}
      {variant === "radiant" && <div className="bg-rays" />}

      {/* זוהר רחב שנודד לאורך הדף */}
      {variant === "tide" && <div className="bg-drift" />}

      {/* קרני אור מלמעלה */}
      {(variant === "deep" || variant === "dawn") && <div className="bg-shafts" />}

      {/* רשת עדינה - מרקם שהזכוכית שוברת */}
      {!night && <div className="bg-grid" />}

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

      {/* בועות שעולות - אווירות מימיות */}
      {(variant === "ripple" || variant === "tide") &&
        BUBBLES.map((bubble, i) => (
          <span
            key={i}
            className="bg-bubble"
            style={{
              insetInlineStart: `${bubble.left}%`,
              bottom: "-8%",
              width: bubble.size,
              height: bubble.size,
              ["--sway" as string]: `${bubble.sway}px`,
              animationDuration: `${bubble.duration}s`,
              animationDelay: `${bubble.delay}s`,
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

      {/* לבנים מרחפות - העומק של החלל. לא במסך השקט, שבו התוכן
          צריך את כל תשומת הלב. */}
      {!quiet &&
        ORBS.map((orb, i) => (
          <span
            key={i}
            className="glass-orb"
            style={{
              insetInlineStart: `${orb.left}%`,
              top: `${orb.top}%`,
              width: orb.size,
              height: orb.size,
              ["--depth" as string]: orb.depth,
              ["--dx" as string]: `${orb.dx}px`,
              ["--dy" as string]: `${orb.dy}px`,
              ["--spin-from" as string]: `${orb.spinFrom}deg`,
              ["--spin-to" as string]: `${orb.spinTo}deg`,
              animationDuration: `${orb.duration}s`,
              animationDelay: `${orb.delay}s`,
            }}
          />
        ))}

      {/* הכהיית קצוות - ממקדת את העין פנימה */}
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
function AppBackground({ children, botanical = false, variant, className }: Props) {
  return (
    <>
      <BackgroundLayers botanical={botanical} variant={variant} />
      <div className={cx("relative min-h-screen", className)}>{children}</div>
    </>
  );
}

export default AppBackground;
