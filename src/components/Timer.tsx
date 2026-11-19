import { useEffect, useRef, useState } from "react";
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
 * טבעת עגולה (2026-11-11, בקשת הלקוחה: "העגול שהיה קודם יפה"). בדרך היו
 * מעוין (2026-11-08) ושעון חול (2026-11-10), ושניהם נפסלו. הטבעת מתחילה
 * למעלה (-rotate-90 על ה-SVG) ומתרוקנת עם כיוון השעון.
 */
const RING = 34; // רדיוס הטבעת ב-SVG
const CIRCUMFERENCE = 2 * Math.PI * RING;

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
      : // טבעת הזמן באדום הלוגו, כמו תג השלב (בקשת הלקוחה, 2026-11-11:
        // "אדום ולא חום"). קודם: צבע העץ.
        { text: "text-ink", stroke: "var(--ds-brand-coral-vivid)" };

  return (
    <>
    <div
      // מסומן כפאנל פינה רק בפינה - הצפייה בשלב 7 מודדת את הפאנלים כדי שהסרטונים לא יעלו עליהם
      data-corner-panel={center ? undefined : ""}
      className={cx(
        "glass glass-brick glass-raised flex",
        center
          ? "flex-none flex-col items-center gap-3 rounded-3xl px-10 py-6"
          : "fixed right-4 bottom-4 z-30 items-center gap-2.5 rounded-xl p-2.5 sm:right-6 sm:bottom-6 sm:gap-3 sm:p-3",
        tone.text,
      )}
      style={
        isWarning ? { animation: "raised-glow 1.6s ease-in-out infinite" } : undefined
      }
    >
      <div
        className={cx(
          "relative flex-none",
          // במרכז הטבעת נגזרת מגובה המסך, כדי שלא תגלוש במסך נמוך
          center ? "h-[min(15rem,30dvh)] w-[min(15rem,30dvh)]" : "h-[70px] w-[70px] sm:h-20 sm:w-20",
        )}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          {/* המסלול - חריץ שקוע: שפת אור דקה מבחוץ, וחריץ כהה בתוכה */}
          <circle cx="40" cy="40" r={RING + 3.6} fill="none" stroke="var(--ds-3d-rim)" strokeWidth="1.2" />
          <circle cx="40" cy="40" r={RING} fill="none" stroke="var(--ds-3d-shade)" strokeWidth="7" />
          <circle cx="40" cy="40" r={RING - 2.4} fill="none" stroke="var(--ds-3d-shade)" strokeWidth="2" opacity="0.8" />
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
              filter: "drop-shadow(0 1px 1.5px var(--ds-3d-shadow-near)) drop-shadow(0 0 6px var(--ds-glow-soft))",
            }}
          />
          {/* פס הברק על הצינור - קו לבן דק בצד הפנימי של אותה קשת */}
          <circle
            cx="40"
            cy="40"
            r={RING - 1.3}
            fill="none"
            stroke="white"
            strokeOpacity="0.7"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>

        {/* דיסק מורם במרכז החוגה - אותו חומר כמו הבועות, בגוון הפאנל */}
        <div className="timer-dial absolute inset-[15%] rounded-full" aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center">
          {isTimeUp ? (
            <Icon name="check" size={center ? 64 : 30} />
          ) : (
            <span
              className={cx(
                "font-extrabold tabular-nums",
                center ? "text-[min(3.6rem,7dvh)]" : "text-xl sm:text-[1.4rem]",
              )}
            >
              {mm}:{ss}
            </span>
          )}
        </div>
      </div>

      <div className={cx(center ? "text-center" : "hidden pe-1 text-start sm:block")}>
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
