import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx";
import Icon from "./ui/Icon";
import GlassModal from "./ui/GlassModal";

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
  /**
   * `corner` (ברירת מחדל) - טיימר השלב, ימין-למטה.
   * `center` - אותה טבעת, גדולה ובתוך זרימת הדף. למשל טיימר הדיון בשלב 6,
   * שרץ בנוסף לטיימר השלב.
   */
  placement?: "corner" | "center";
  /** הכיתוב הקטן ליד הטבעת. ברירת מחדל: "זמן לשלב". */
  label?: string;
  /**
   * השעון עוד לא התחיל - מסך ההמתנה בשער סנכרון, לפני שכל הקבוצות הגיעו.
   * מוצג מלא ועוצר (כל הזמן עוד לפניהן), בלי מעבר אוטומטי ובלי תקתוק.
   */
  pending?: boolean;
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
/** כמה זמן חלונית התזכורת נשארת פתוחה אם אף אחת לא סגרה אותה */
const REMINDER_MS = 8000;

/*
 * ----------------------------------------------------------------------------
 *  שעון חול (בקשת הלקוחה, 2026-11-08: "לשנות לשעון חול וגדול")
 * ----------------------------------------------------------------------------
 *  החול **הוא** הזמן: התא העליון מתרוקן והתחתון מתמלא לפי הזמן שנשאר בפועל
 *  (fraction), וזרם דק יורד ביניהם כל עוד השעון רץ. זה לא AnimatedHourglass
 *  (הלופ הדקורטיבי של מסך ההמתנה) - כאן כל גרגר מייצג זמן אמיתי.
 */
const TOP_BULB = "M18 16 C18 52 45 66 47.5 80 L52.5 80 C55 66 82 52 82 16 Z";
const BOTTOM_BULB = "M18 144 C18 108 45 94 47.5 80 L52.5 80 C55 94 82 108 82 144 Z";
const BULB_H = 64; // גובה כל תא, מהצוואר (80) עד השפה (16 / 144)

function HourglassGauge({
  fraction,
  sand,
  running,
  className,
}: {
  /** 1 = כל הזמן לפנינו (התא העליון מלא), 0 = נגמר. */
  fraction: number;
  sand: string;
  running: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const topH = BULB_H * fraction;
  const bottomH = BULB_H * (1 - fraction);

  return (
    <svg viewBox="0 0 100 160" className={className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-top`}>
          <path d={TOP_BULB} />
        </clipPath>
        <clipPath id={`${id}-bottom`}>
          <path d={BOTTOM_BULB} />
        </clipPath>
      </defs>

      {/* הזכוכית: מילוי לבן עדין */}
      <path d={TOP_BULB} style={{ fill: "var(--ds-glass-strong)" }} />
      <path d={BOTTOM_BULB} style={{ fill: "var(--ds-glass-strong)" }} />

      {/* החול שנשאר - יושב בתחתית התא העליון, צמוד לצוואר */}
      <g clipPath={`url(#${id}-top)`}>
        <rect
          x="0"
          y={80 - topH}
          width="100"
          height={topH}
          style={{ fill: sand, transition: "y 1s linear, height 1s linear, fill var(--ds-dur) var(--ds-ease)" }}
        />
      </g>

      {/* הזרם - רק כשהשעון רץ ויש עוד חול למעלה */}
      {running && fraction > 0 && (
        <line
          x1="50"
          y1="80"
          x2="50"
          y2={144 - bottomH}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="3 4"
          style={{ stroke: sand, animation: "sand-stream 0.6s linear infinite" }}
        />
      )}

      {/* החול שנערם למטה - עם תלולית קטנה באמצע */}
      <g clipPath={`url(#${id}-bottom)`}>
        <path
          d={`M0 ${144 - bottomH + 4} Q50 ${144 - bottomH - 6} 100 ${144 - bottomH + 4} L100 160 L0 160 Z`}
          style={{ fill: sand, transition: "d 1s linear, fill var(--ds-dur) var(--ds-ease)" }}
        />
      </g>

      {/* קו המתאר והמכסים - בנייבי של הלוגו */}
      <g fill="none" strokeWidth="3" strokeLinejoin="round" style={{ stroke: "var(--ds-navy)" }}>
        <path d={TOP_BULB} />
        <path d={BOTTOM_BULB} />
      </g>
      <rect x="10" y="6" width="80" height="10" rx="4" style={{ fill: "var(--ds-wood)" }} />
      <rect x="10" y="144" width="80" height="10" rx="4" style={{ fill: "var(--ds-wood)" }} />
      {/* נצנוץ על הזכוכית */}
      <path d="M26 24 C26 44 36 56 42 64" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Timer({
  startedAt,
  durationMinutes,
  onTimeUp,
  hidden = false,
  placement = "corner",
  label = "זמן לשלב",
  pending = false,
}: Props) {
  const center = placement === "center";
  const [now, setNow] = useState(() => Date.now());
  // כדי שהמעבר האוטומטי יקרה פעם אחת בלבד לכל שלב, גם אם הרכיב מתרנדר שוב
  const firedForRef = useRef<string | null>(null);
  // חלונית "נותרה דקה" - פעם אחת לכל שלב (startedAt), ורק כשרואים את המעבר
  // לדקה האחרונה בזמן אמת. מסך שרוענן בתוך הדקה האחרונה לא יקפיץ אותה שוב.
  const [reminderOpen, setReminderOpen] = useState(false);
  const wasWarningRef = useRef<boolean | null>(null);
  const remindedForRef = useRef<string | null>(null);
  const trackedStartRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = pending ? 0 : now - new Date(startedAt).getTime();
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
  const inLastMinute = !pending && !isTimeUp && totalSeconds <= WARN_SECONDS;

  // החלונית רק בטיימר השלב שבפינה: לא במסך מוסתר (שלב 1), לא בטיימר הדיון
  // שבמרכז (שלב 6 - אחרת שתי חלוניות), ולא בשלב שכולו קצר מדקה.
  const remindable = !hidden && !center && !pending && durationMinutes > 1;

  useEffect(() => {
    // שלב חדש - מתחילים את המעקב מחדש
    if (trackedStartRef.current !== startedAt) {
      trackedStartRef.current = startedAt;
      wasWarningRef.current = null;
    }
    const prev = wasWarningRef.current;
    wasWarningRef.current = inLastMinute;
    if (!remindable || prev !== false || !inLastMinute) return;
    if (remindedForRef.current === startedAt) return;
    remindedForRef.current = startedAt;
    setReminderOpen(true);
  }, [inLastMinute, remindable, startedAt]);

  // נסגרת לבד אחרי כמה שניות, ובוודאי כשהזמן נגמר
  useEffect(() => {
    if (!reminderOpen) return;
    const t = setTimeout(() => setReminderOpen(false), REMINDER_MS);
    return () => clearTimeout(t);
  }, [reminderOpen]);
  useEffect(() => {
    if (isTimeUp || pending) setReminderOpen(false);
  }, [isTimeUp, pending]);

  // אין צליל בדקה האחרונה: התקתוק המלחיץ הוסר לבקשת הלקוחה (2026-10-25).
  // הדקה האחרונה מסומנת בטיימר עצמו בלבד, ויזואלית.

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
      : // טבעת הזמן בצבע העץ - אחד מצבעי הפלטה, כדי שלא הכול יהיה קורל
        { text: "text-ink", stroke: "var(--ds-wood)" };

  return (
    <>
    <div
      // מסומן כפאנל פינה רק בפינה - הצפייה בשלב 7 מודדת את הפאנלים כדי שהסרטונים לא יעלו עליהם
      data-corner-panel={center ? undefined : ""}
      className={cx(
        "glass glass-brick glass-raised flex",
        center
          ? "flex-none flex-col items-center gap-3 rounded-2xl px-10 py-6"
          : "fixed right-4 bottom-4 z-30 items-center gap-3 rounded-xl p-3 sm:right-6 sm:bottom-6 sm:gap-4 sm:p-4",
        tone.text,
      )}
      style={
        isWarning ? { animation: "raised-glow 1.6s ease-in-out infinite" } : undefined
      }
    >
      {/* שעון החול - גדול (בקשת הלקוחה). במרכז הוא נגזר מגובה המסך, כדי
          שלא יגלוש במסך נמוך */}
      <HourglassGauge
        fraction={pending ? 1 : fraction}
        sand={tone.stroke}
        running={!pending && !isTimeUp}
        className={cx("flex-none", center ? "h-[min(17rem,32dvh)] w-auto" : "h-28 w-auto sm:h-32")}
      />

      <div className={cx(center ? "text-center" : "pe-1 text-start")}>
        {/* הספרות גדולות ליד השעון - נקראות מהצד השני של החדר */}
        <div
          className={cx(
            "flex font-extrabold tabular-nums leading-none",
            center ? "mb-2 justify-center text-[min(3.6rem,7dvh)]" : "mb-1.5 text-3xl sm:text-4xl",
          )}
        >
          {isTimeUp ? <Icon name="check" size={center ? 56 : 32} /> : `${mm}:${ss}`}
        </div>
        <div
          className={cx(
            "text-ink-3 flex items-center gap-1.5 font-bold tracking-wide",
            center ? "justify-center text-base" : "text-[11px]",
          )}
        >
          <Icon name="clock" size={center ? 18 : 13} />
          {label}
        </div>
        <div className={cx("font-bold", center ? "text-xl" : "text-base")}>
          {pending
            ? "מתחיל כשכולן יגיעו"
            : isTimeUp
              ? "הזמן נגמר"
              : isWarning
                ? "דקה אחרונה"
                : `${durationMinutes} דקות`}
        </div>
      </div>

      {/* הכרזה לקוראת מסך רק כשהזמן נגמר - לא כל שנייה */}
      <span role="status" className="sr-only">
        {isTimeUp ? "הזמן לשלב הסתיים" : ""}
      </span>
    </div>

    {/* בפורטל ל-body: הטיימר עצמו הוא זכוכית עם backdrop-filter, ובתוכו
        position:fixed נמדד ביחס לטיימר ולא לחלון (מלכודת 6 ב-CLAUDE.md) */}
    {reminderOpen &&
      createPortal(
        <GlassModal
          open
          tone="warn"
          icon="clock"
          title="נותרה דקה אחת לסיום"
          description="זה הזמן לסכם ולסיים את העבודה על השלב."
          confirmLabel="הבנו"
          onConfirm={() => setReminderOpen(false)}
          hideCancel
          onClose={() => setReminderOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

export default Timer;
