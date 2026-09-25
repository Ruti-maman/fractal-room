import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx";
import Icon from "./ui/Icon";

interface Props {
  startedAt: string;
  durationMinutes: number;
  /** נקראת פעם אחת כשנגמר הזמן - המסך עובר לשלב הבא לבד (תשובת הלקוחה). */
  onTimeUp?: () => void;
  /**
   * מסתיר את התצוגה בלבד. הספירה עצמה ממשיכה לרוץ והמעבר האוטומטי עדיין
   * קורה - כך מסך הפתיחה (שלב 1) נשאר נקי בלי טיימר גלוי, אבל עדיין
   * מתקדם לבד בתום הזמן. לפי בקשת הלקוחה.
   */
  hidden?: boolean;
}

/**
 * אין ספירה לאחור מקומית - הטיימר תמיד מחשב מחדש מהשעה האמיתית מול זמן ההתחלה
 * שנשמר במסד הנתונים (סעיף 5 ב-CLAUDE.md). כך רענון מסך לא משבש את הזמן שנותר.
 *
 * ----------------------------------------------------------------------------
 * העיצוב: טבעת זכוכית שמתרוקנת
 * ----------------------------------------------------------------------------
 * המספר לבדו לא אומר כלום מרחוק - "03:40" מחייב לקרוא ולחשב. הטבעת מסביבו
 * נקראת במבט אחד מהצד השני של החדר: כמה נשאר זה כמה טורקיז נשאר.
 *
 * שלושה מצבים, שמשנים גם צבע וגם התנהגות:
 *   רגיל   - טורקיז שקט.
 *   מתקרב  - דקה אחרונה: כתום רך והטבעת נושמת, בלי אזעקה.
 *   נגמר   - אדום רך, והטיימר מכריז על עצמו לקוראת מסך.
 *
 * מיקום: ימין למטה, כנדרש בסעיף 5 ב-CLAUDE.md.
 */

const WARN_SECONDS = 60;
const RING = 34; // רדיוס הטבעת ב-SVG
const CIRCUMFERENCE = 2 * Math.PI * RING;

function Timer({ startedAt, durationMinutes, onTimeUp, hidden = false }: Props) {
  const [now, setNow] = useState(() => Date.now());
  // כדי שהמעבר האוטומטי יקרה פעם אחת בלבד לכל שלב, גם אם הרכיב מתרנדר שוב
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalMs = durationMinutes * 60_000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const isTimeUp = remainingMs <= 0;

  useEffect(() => {
    if (!isTimeUp || !onTimeUp) return;
    if (firedForRef.current === startedAt) return;
    firedForRef.current = startedAt;
    onTimeUp();
  }, [isTimeUp, onTimeUp, startedAt]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  // אחרי כל ה-hooks בכוונה: הספירה והמעבר האוטומטי חייבים להמשיך לרוץ גם
  // כשהתצוגה מוסתרת (ראו התיעוד של `hidden`).
  if (hidden) return null;

  const isWarning = !isTimeUp && totalSeconds <= WARN_SECONDS;
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;

  const tone = isTimeUp
    ? { text: "text-danger", stroke: "var(--ds-danger)" }
    : isWarning
      ? { text: "text-warn", stroke: "var(--ds-warn)" }
      : { text: "text-ink", stroke: "var(--ds-accent)" };

  return (
    <div
      className={cx(
        "glass glass-brick fixed right-4 bottom-4 z-30 flex items-center gap-3 rounded-xl p-3 sm:right-6 sm:bottom-6 sm:gap-4 sm:p-4",
        tone.text,
      )}
      style={
        isWarning ? { animation: "success-glow 1.6s ease-in-out infinite" } : undefined
      }
    >
      <div className="relative h-[84px] w-[84px] flex-none sm:h-24 sm:w-24">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          {/* המסלול - זכוכית קעורה */}
          <circle
            cx="40"
            cy="40"
            r={RING}
            fill="none"
            stroke="var(--ds-glass-strong)"
            strokeWidth="6"
          />
          {/* מה שנשאר מהזמן */}
          <circle
            cx="40"
            cy="40"
            r={RING}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            style={{
              transition: "stroke-dashoffset 1s linear, stroke var(--ds-dur) var(--ds-ease)",
              filter: "drop-shadow(0 0 6px var(--ds-glow-soft))",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          {isTimeUp ? (
            <Icon name="check" size={30} />
          ) : (
            <span className="text-2xl font-extrabold tabular-nums sm:text-[1.7rem]">
              {mm}:{ss}
            </span>
          )}
        </div>
      </div>

      <div className="hidden pe-1 text-start sm:block">
        <div className="text-ink-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wide">
          <Icon name="clock" size={13} />
          זמן לשלב
        </div>
        <div className="text-base font-bold">
          {isTimeUp ? "הזמן נגמר" : isWarning ? "דקה אחרונה" : `${durationMinutes} דקות`}
        </div>
      </div>

      {/* הכרזה לקוראת מסך רק כשהזמן נגמר - לא כל שנייה */}
      <span role="status" className="sr-only">
        {isTimeUp ? "הזמן לשלב הסתיים" : ""}
      </span>
    </div>
  );
}

export default Timer;
