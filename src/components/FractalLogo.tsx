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
}

function FractalLogo({ className, emblemOnly = false, style }: Props) {
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
          style={{ fill: s.coral ? "var(--ds-brand-coral)" : "var(--ds-brand-ink)" }}
        />
      ))}
      {!emblemOnly && (
        <>
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
        </>
      )}
    </svg>
  );
}

export default FractalLogo;
