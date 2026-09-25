/*
 * ============================================================================
 *  איורים בוטניים קוויים
 * ============================================================================
 *
 *  נגיעה דקורטיבית אחת שמרככת את הלוח: ענף בקו דק, בטורקיז שקוף, בפינת
 *  כרטיס גדול או במסך ריק. **במשורה** - שניים-שלושה בדף לכל היותר, אחרת
 *  זה מפסיק להיות אלגנטי ומתחיל להיות רועש.
 *
 *  צוירו כאן ביד ולא נלקחו מספריית איורים: אין CDN (סעיף 2 ב-CLAUDE.md),
 *  וגם ככה איור וקטורי בקו אחד הוא כמה מאות בייטים.
 *
 *  כולם `currentColor` + `aria-hidden`: הם קישוט, לא מידע, ולכן קוראת מסך
 *  מדלגת עליהם, והצבע נקבע מההקשר.
 */

import type { SVGProps } from "react";
import { cx } from "../../lib/cx";

type Variant = "lavender" | "fern" | "seagrass" | "sprig";

interface Props extends SVGProps<SVGSVGElement> {
  variant?: Variant;
  /** גובה בפיקסלים. הרוחב נגזר מיחס הצורה. */
  size?: number;
}

/**
 * לבנדר - גבעול ארוך עם שיבולת פריחה בראשו.
 *
 * הפריחה מצוירת כ**זוגות עלי כותרת נטויים** ולא כעיגולים מוערמים: ניסיון
 * ראשון עם עיגולים יצר צורה שנקראת כמו שרשרת חרוזים, לא כמו פרח.
 */
function Lavender() {
  return (
    <>
      {/* הגבעול, עם עיקול קל כדי שלא ייראה כמו קו סרגל */}
      <path d="M32 120c0-24 1-42 2-58" />
      {/* עלים ארוכים וצרים בבסיס */}
      <path d="M33 102c-9-2-15-8-17-17 9 0 16 6 17 14" />
      <path d="M33 88c9-2 15-8 17-17-9 0-16 6-17 14" />
      <path d="M33 76c-8-2-13-7-14-14 7 0 13 5 14 11" />
      {/* שיבולת הפריחה - זוגות עלי כותרת נטויים שמתקטנים כלפי מעלה */}
      {[
        { y: 62, w: 9, h: 7 },
        { y: 52, w: 8, h: 6.5 },
        { y: 43, w: 6.5, h: 6 },
        { y: 35, w: 5.5, h: 5.5 },
        { y: 28, w: 4.5, h: 5 },
        { y: 22, w: 3.5, h: 4.5 },
      ].map(({ y, w, h }) => (
        <g key={y}>
          <path d={`M34 ${y}c-${w} 0-${w} -${h} 0-${h}`} />
          <path d={`M34 ${y}c${w} 0 ${w} -${h} 0-${h}`} />
        </g>
      ))}
      {/* הניצן העליון */}
      <path d="M34 16c-2.5 0-2.5-5 0-5s2.5 5 0 5z" />
    </>
  );
}

/** שרך - ציר מרכזי עם עלים נגדיים שמתקצרים לקצה. */
function Fern() {
  return (
    <>
      <path d="M32 120C32 84 34 52 46 16" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const y = 104 - i * 14;
        const len = 26 - i * 3;
        const x = 32 + i * 2;
        return (
          <g key={i}>
            <path d={`M${x} ${y}c-${len * 0.5} -2 -${len} -8 -${len} -14`} />
            <path d={`M${x} ${y}c${len * 0.45} -3 ${len * 0.8} -9 ${len * 0.8} -15`} />
          </g>
        );
      })}
    </>
  );
}

/** עשב ים - כמה להבים שמתעקלים, כאילו זרם מים מטה אותם. */
function Seagrass() {
  return (
    <>
      <path d="M24 120C24 92 18 66 8 44" />
      <path d="M32 120C32 88 34 56 44 28" />
      <path d="M40 120c0-26 8-50 20-68" />
      <path d="M30 120c-1-20-6-38-14-52" />
      {/* בועות קטנות שעולות - הרמז ה"ימי" */}
      <circle cx="50" cy="40" r="3" />
      <circle cx="58" cy="26" r="2" />
      <circle cx="14" cy="52" r="2.5" />
    </>
  );
}

/** ענף קטן - שני עלים על גבעול. הצנוע מכולם, לשוליים של כרטיס. */
function Sprig() {
  return (
    <>
      <path d="M32 120V36" />
      <path d="M32 84c-14 0-22-9-22-22 13 0 22 9 22 22z" />
      <path d="M32 64c14 0 22-9 22-22-13 0-22 9-22 22z" />
      <path d="M32 44c-10 0-16-7-16-16 9 0 16 7 16 16z" />
    </>
  );
}

const SHAPES: Record<Variant, () => React.JSX.Element> = {
  lavender: Lavender,
  fern: Fern,
  seagrass: Seagrass,
  sprig: Sprig,
};

function Botanical({ variant = "sprig", size = 120, className, ...rest }: Props) {
  const Shape = SHAPES[variant];

  return (
    <svg
      viewBox="0 0 64 128"
      height={size}
      width={(size * 64) / 128}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx("pointer-events-none flex-none", className)}
      {...rest}
    >
      <Shape />
    </svg>
  );
}

export default Botanical;
