/*
 * ============================================================================
 *  הסרגל העליון
 * ============================================================================
 *
 *  רצועה קבועה בראש כל מסך בסדנה, שעונה על שתי שאלות שלא היו להן תשובה
 *  קודם: **מי אני** (איזו קבוצה זו, באיזה מסך) ו**האם המערכת בסדר**.
 *
 *  זהות הקבוצה חשובה כאן יותר מהרגיל: שלוש פלזמות זהות בחדר אחד, ושלוש
 *  קבוצות שמסתובבות ביניהן. בלי חיווי, קבוצה יכולה לעמוד מול המסך של
 *  השכנה ולהזין אליו נתונים.
 *
 *  הפקדים השקטים (מצב תצוגה, חיבור) יושבים בקצה הנגדי וקטנים בכוונה -
 *  הם לא חלק מהתהליך הפדגוגי.
 */

import type { Group } from "../types/group";
import Icon from "./ui/Icon";
import { ConnectionBadge, ThemeToggle } from "./ui/SystemControls";

interface Props {
  myGroup: Group;
  screenNumber: number;
  /** מוצג באמצע כשיש מסקנה מעשית - ראו PracticalConclusionBanner. */
  center?: React.ReactNode;
  /** חזרה לשלב הקודם. לא מוצג בשלב הראשון, שאין לו קודם. */
  onGoBack?: () => void;
}

function TopBar({ myGroup, screenNumber, center, onGoBack }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-4 p-4 sm:p-5">
      {/* זהות הקבוצה - בצד ההתחלה (ימין ב-RTL) */}
      <div className="glass glass-pill pointer-events-auto flex-none gap-2.5 py-2 ps-3 pe-4">
        <span
          aria-hidden="true"
          className="glass glass-active flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-extrabold"
        >
          {screenNumber}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-ink-3 text-[10px] font-bold tracking-wide">
            מסך {screenNumber}
          </span>
          <span className="text-ink max-w-[11rem] truncate text-sm font-extrabold">
            {myGroup.name ?? "טרם הזדהיתן"}
          </span>
        </span>
      </div>

      {/* המסקנה המעשית, כשיש */}
      <div className="pointer-events-auto flex min-w-0 flex-1 justify-center">{center}</div>

      {/* פקדי מערכת - בצד הסיום (שמאל ב-RTL) */}
      <div className="pointer-events-auto flex flex-none items-center gap-2">
        {onGoBack && <BackButton onClick={onGoBack} />}
        <ConnectionBadge />
        <ThemeToggle />
      </div>
    </div>
  );
}

/**
 * חזרה לשלב הקודם.
 *
 * יושב בסרגל העליון ולא במרכז התחתון, למרות שפעולות חשובות אמורות להיות
 * במחצית התחתונה (סעיף 2 ב-CLAUDE.md): במרכז התחתון הוא התנגש בכפתור
 * הפעולה של השלב עצמו ("הבא", "שמרי", "המשך להקלטה"), וזה בדיוק המקום
 * שאסור שיהיה בו ספק מה לוחצים. זו גם לא פעולה ראשית אלא פקד התאוששות -
 * שימוש בו הוא היוצא מן הכלל, לא הזרימה.
 *
 * הכיתוב מתקצר ל"חזרה" על מסך צר, כדי שלא ידחוף את מתג התצוגה מהשורה.
 */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="חזרה לשלב הקודם"
      onClick={onClick}
      className="glass glass-interactive glass-pill text-ink-2 hover:text-ink gap-2 px-4 py-2 text-sm font-bold"
    >
      <Icon name="arrowBack" size={16} />
      <span className="hidden sm:inline">חזרה לשלב הקודם</span>
      <span className="sm:hidden">חזרה</span>
    </button>
  );
}

export default TopBar;
