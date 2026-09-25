/*
 * ============================================================================
 *  רקע הדף
 * ============================================================================
 *
 *  לזכוכית אין משמעות בלי משהו מאחוריה. הרקע כאן הוא מה שה-backdrop-filter
 *  מטשטש, ובלעדיו כל הלבנים היו נראות כמו מלבנים אפורים.
 *
 *  שלוש שכבות:
 *    1. גרדיאנט הבסיס - יושב על ה-body (ראו index.css), כדי שאפילו הפריים
 *       הראשון לפני ש-React עולה יהיה בצבע הנכון.
 *    2. כתמי אור (blobs) - שלושה כתמים מטושטשים שנעים לאט מאוד.
 *    3. רשת עדינה - קווים כמעט בלתי נראים שנותנים לזכוכית מרקם לשבור.
 *
 *  **ביצועים:** הכתמים מצוירים כ-radial-gradient על אלמנט אחד ולא כשלושה
 *  אלמנטים עם blur(120px). blur על שטח גדול הוא הדבר היקר ביותר שאפשר
 *  לבקש מ-WebView של אנדרואיד, וכאן הוא נחסך לגמרי - הרכות מגיעה מעצם
 *  הגרדיאנט. זה משאיר את תקציב ה-GPU לטשטוש של הזכוכית עצמה, ששם הוא
 *  באמת נדרש.
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

export function BackgroundLayers({ botanical = false }: Pick<Props, "botanical">) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* כתמי האור - שלושה גרדיאנטים רדיאליים על משטח אחד */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(42rem 34rem at 12% 8%, var(--ds-blob-a), transparent 70%),
            radial-gradient(38rem 30rem at 88% 82%, var(--ds-blob-b), transparent 72%),
            radial-gradient(30rem 26rem at 70% 12%, var(--ds-blob-c), transparent 74%)
          `,
          animation: "aurora-drift 34s ease-in-out infinite",
        }}
      />

      {/* רשת עדינה - נותנת לזכוכית מרקם לשבור במקום שטח אחיד */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `
            linear-gradient(var(--ds-edge-dim) 1px, transparent 1px),
            linear-gradient(90deg, var(--ds-edge-dim) 1px, transparent 1px)
          `,
          backgroundSize: "68px 68px",
          maskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 78%)",
        }}
      />

      {botanical && (
        <Botanical
          variant={botanical}
          size={360}
          className="text-accent absolute bottom-[-4rem] left-[-3rem] opacity-[0.12] rotate-[8deg]"
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
