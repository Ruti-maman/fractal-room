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

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Group } from "../types/group";
import { supabase } from "../lib/supabase";
import Icon from "./ui/Icon";
import { ThemeToggle } from "./ui/SystemControls";

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
      {/* זהות הקבוצה - בצד ההתחלה (ימין ב-RTL). נגיעה/ריחוף מציגים את המשתתפות. */}
      <GroupBadge myGroup={myGroup} screenNumber={screenNumber} />

      {/* המסקנה המעשית, כשיש */}
      <div className="pointer-events-auto flex min-w-0 flex-1 justify-center">{center}</div>

      {/* פקדי מערכת - בצד הסיום (שמאל ב-RTL). כאן רק שומר מקום בלתי נראה
          באותו גודל, כדי שהמסקנה באמצע לא תזוז; הפקדים עצמם ב-portal למטה. */}
      <div aria-hidden="true" className="invisible flex flex-none items-center gap-2">
        <SystemButtons onGoBack={onGoBack} />
      </div>

      {/* "תמיד תהיה אפשרות לחזור אחורה" (בקשת הלקוחה, 2026-11-08): מסכים
          מלאים (ההזדהות בשלב 2, "כלל הפרקטל", סרטון במסך מלא) יושבים מעל
          הסרגל (z-40) ומסתירים אותו. לכן הפקדים בשכבה משלהם, מעל כולם.
          portal ל-body: בתוך הסרגל (fixed עם z-40) שום z-index של ילד לא
          היה עובר אותו. */}
      {createPortal(
        <div className="pointer-events-none fixed end-0 top-0 z-[75] flex p-4 sm:p-5">
          <div className="pointer-events-auto flex items-center gap-2">
            <SystemButtons onGoBack={onGoBack} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function SystemButtons({ onGoBack }: { onGoBack?: () => void }) {
  return (
    <>
      {onGoBack && <BackButton onClick={onGoBack} />}
      {/* חיווי הוויי-פיי הוסר לבקשת הלקוחה ("להוריד את כל הסימונים של
          הוויי-פיי"). ConnectionBadge נשאר ב-SystemControls אם יידרש שוב. */}
      <ThemeToggle />
    </>
  );
}

/**
 * תג הקבוצה + רשימת המשתתפות שנפתחת ממנו.
 *
 * נפתח בריחוף (עכבר) ובנגיעה (מסך המגע בחדר - שם אין ריחוף), ונסגר
 * בנגיעה מחוץ לו. השמות נטענים **בכל פתיחה** בשאילתה רגילה, בלי ערוץ
 * Realtime: שלב 7 כבר מחזיק ערוץ `participants-<group>` (useParticipants),
 * ושני ערוצים באותו שם מפילים את supabase-js (באג 3 ב-CLAUDE.md). רשימה
 * שנפתחת לרגע לא צריכה עדכון חי.
 */
function GroupBadge({ myGroup, screenNumber }: { myGroup: Group; screenNumber: number }) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from("participants")
      .select("name, created_at")
      .eq("group_id", myGroup.id)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setNames((data ?? []).map((p) => p.name as string));
      });

    function onOutside(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onOutside);
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, myGroup.id]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto relative flex-none"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        // פותח תמיד ולא מחליף מצב: בעכבר הריחוף כבר פתח, ו-toggle היה סוגר
        // מיד. סגירה - נגיעה מחוץ לתג או יציאת העכבר.
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={`${myGroup.name ?? `מסך ${screenNumber}`} - הצגת המשתתפות`}
        className="glass glass-raised glass-pill btn-rect gap-3 py-2.5 ps-3.5 pe-5 text-start"
      >
        <span
          aria-hidden="true"
          className={`bubble bubble--${((screenNumber - 1) % 5) + 1} flex h-11 w-11 flex-none items-center justify-center text-base font-extrabold`}
        >
          {screenNumber}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-ink-3 text-xs font-bold tracking-wide">
            מסך {screenNumber}
          </span>
          <span className="text-ink max-w-[13rem] truncate text-base font-extrabold">
            {myGroup.name ?? "טרם הזדהיתן"}
          </span>
        </span>
        <Icon
          name="users"
          size={18}
          className={`text-ink-3 flex-none transition-transform duration-200 ${open ? "scale-110 text-accent" : ""}`}
        />
      </button>

      {open && (
        // pt-2 ולא mt-2: הריווח הוא חלק מהאזור, כך שהעכבר לא "נופל" בפער
        // בדרך מהתג לרשימה והיא לא נסגרת.
        <div className="absolute top-full right-0 z-50 pt-2">
          <div
            className="glass glass-brick glass-raised w-64 rounded-xl p-3"
            style={{ animation: "fade-up var(--ds-dur) var(--ds-ease) both" }}
          >
            <p className="text-ink-3 mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold">
              <Icon name="users" size={13} />
              המשתתפות בקבוצה
              {names && <span className="tabular-nums">({names.length})</span>}
            </p>
            {names === null ? (
              <p className="text-ink-3 px-1 py-2 text-sm">טוען...</p>
            ) : names.length === 0 ? (
              <p className="text-ink-3 px-1 py-2 text-sm">עדיין לא נרשמו משתתפות</p>
            ) : (
              <ul className="glass-scroll flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
                {names.map((n, i) => (
                  <li key={`${i}-${n}`} className="flex items-center gap-2.5 px-1 py-0.5">
                    <span
                      aria-hidden="true"
                      className={`bubble bubble--${(i % 5) + 1} flex h-7 w-7 flex-none items-center justify-center text-[11px] font-extrabold`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-ink truncate text-base font-bold">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
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
      className="glass glass-interactive glass-3d glass-pill btn-rect text-ink-2 hover:text-ink gap-2 px-4 py-2 text-sm font-bold"
    >
      <Icon name="arrowBack" size={16} />
      <span className="hidden sm:inline">חזרה לשלב הקודם</span>
      <span className="sm:hidden">חזרה</span>
    </button>
  );
}

export default TopBar;
