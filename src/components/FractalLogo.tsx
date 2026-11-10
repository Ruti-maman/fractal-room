/*
 * ============================================================================
 *  הלוגו של פרקטל - בווקטור, בלי הרקע הכחול
 * ============================================================================
 *
 *  בנוי מחדש מקובץ הלוגו של הלקוחה (public/brand/fractal-logo.png), כי:
 *   - הלקוחה ביקשה את הלוגו **בלי הרקע הכחול**, על הרקע של הסדנה;
 *   - בצלילת הזום (ZoomIntro) הלוגו גדל פי 14 - תמונה הייתה מתפקססת,
 *     וקטור נשאר חד.
 *
 *  הסמל הוא "עץ פיתגורס": ריבוע, ומעליו שני ריבועים בזווית 45°, ומעל
 *  כל אחד שניים קטנים יותר - ארבע קומות, בדיוק כמו בלוגו. ריבוע אחד
 *  (וזוג הקטנים שמעליו) בקורל, כמו במקור.
 *
 *  צבעים: --ds-brand-ink (נייבי במצב בהיר, לבן במצב כהה) ו-
 *  --ds-brand-coral, מוגדרים ב-tokens.css.
 */

import type { CSSProperties } from "react";

type Pt = [number, number];

interface Square {
  points: Pt[];
  coral: boolean;
}

/** ריבוע על הבסיס a→b (בונה "למעלה"), וילדיו בעץ עד העומק המבוקש. */
function tree(a: Pt, b: Pt, depth: number, path: string, out: Square[]) {
  const v: Pt = [b[0] - a[0], b[1] - a[1]];
  // "למעלה" ביחס לבסיס (ב-SVG ציר y יורד): סיבוב של 90° נגד כיוון השעון
  const up: Pt = [v[1], -v[0]];
  const d: Pt = [a[0] + up[0], a[1] + up[1]];
  const c: Pt = [b[0] + up[0], b[1] + up[1]];
  // הריבוע שבקורל: בענף השמאלי, הילד שפונה למעלה - וכל מה שמעליו
  const coral = path.startsWith("LR");
  out.push({ points: [a, b, c, d], coral });
  if (depth === 0) return;
  // קודקוד המשולש ישר-הזווית שעל הצלע העליונה (45°-45°)
  const mid: Pt = [(d[0] + c[0]) / 2, (d[1] + c[1]) / 2];
  const top: Pt = [mid[0] + up[0] / 2, mid[1] + up[1] / 2];
  tree(d, top, depth - 1, path + "L", out);
  tree(top, c, depth - 1, path + "R", out);
}

const SQUARES: Square[] = [];
tree([-22, 0], [22, 0], 3, "", SQUARES);

const toPoints = (pts: Pt[]) => pts.map((p) => p.join(",")).join(" ");

interface Props {
  className?: string;
  /** בלי המילים - רק הסמל. */
  emblemOnly?: boolean;
  style?: CSSProperties;
  /**
   * הלוגו "מתפזר לריבועים" (בקשת הלקוחה, 2026-11-08): אחרי רגע של החזקה
   * כל ריבוע של העץ עף החוצה בכיוון שלו, מסתובב ונמוג. מתחיל אחרי
   * shatterDelay שניות.
   */
  shatter?: boolean;
  shatterDelay?: number;
}

/* מרכז הסמל (בערך) - כל ריבוע עף בכיוון שמרכזו -> מרכז הריבוע */
const EMBLEM_CENTER: Pt = [0, -62];

function shardStyle(s: Square, i: number, delay: number): CSSProperties {
  const cx = s.points.reduce((sum, p) => sum + p[0], 0) / 4;
  const cy = s.points.reduce((sum, p) => sum + p[1], 0) / 4;
  let dx = cx - EMBLEM_CENTER[0];
  let dy = cy - EMBLEM_CENTER[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // ריבועים קטנים (קרובים לקצוות) עפים רחוק יותר
  const dist = 260 + (i % 4) * 70;
  return {
    transformBox: "fill-box",
    transformOrigin: "center",
    ["--sx" as string]: `${dx * dist}px`,
    ["--sy" as string]: `${dy * dist}px`,
    // סיבוב מתון ו-ease-out רך: הריבועים "מרחפים" החוצה ולא נזרקים
    ["--sr" as string]: `${(i % 2 ? 1 : -1) * (50 + (i % 3) * 30)}deg`,
    animation: `shard-fly 1.7s ${delay + (i % 5) * 0.04}s cubic-bezier(0.22, 1, 0.36, 1) both`,
  };
}

function FractalLogo({ className, emblemOnly = false, style, shatter = false, shatterDelay = 0.9 }: Props) {
  return (
    <svg
      // צמוד לגבולות הלוגו עצמו (בלי שוליים ריקים), כדי שימלא את המקום שנותנים לו
      viewBox={emblemOnly ? "-80 -136 160 138" : "-104 -136 208 236"}
      className={className}
      style={style}
      role="img"
      aria-label="פרקטל - עומק. מימד. חדשנות."
    >
      {SQUARES.map((s, i) => (
        <polygon
          key={i}
          points={toPoints(s.points)}
          style={{
            fill: s.coral ? "var(--ds-brand-coral)" : "var(--ds-brand-ink)",
            ...(shatter ? shardStyle(s, i, shatterDelay) : null),
          }}
        />
      ))}
      {!emblemOnly && (
        <g style={shatter ? { animation: `shard-fade 0.9s ${shatterDelay}s ease-out both` } : undefined}>
          <text
            x={0}
            y={58}
            textAnchor="middle"
            direction="rtl"
            style={{ fill: "var(--ds-brand-coral)", font: "800 64px Assistant, sans-serif" }}
          >
            פרקטל
          </text>
          <text
            x={0}
            y={92}
            textAnchor="middle"
            direction="rtl"
            style={{ fill: "var(--ds-brand-ink)", font: "600 21px Assistant, sans-serif" }}
          >
            עומק. מימד. חדשנות.
          </text>
        </g>
      )}
    </svg>
  );
}

export default FractalLogo;
