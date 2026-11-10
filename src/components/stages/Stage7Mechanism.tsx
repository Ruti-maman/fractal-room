import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import StageShell from "../StageShell";
import Icon, { type IconName } from "../ui/Icon";
import { GlassButton } from "../ui/Glass";
import { cx } from "../../lib/cx";

/*
 * ============================================================================
 *  שלב 7, מסך פתיחה - "מרעיון למנגנון"
 * ============================================================================
 *
 *  לפי התסריט של הלקוחה, לפני הוראות הסימולציה: לוקחות את הרעיון מהדיון
 *  (שלב 6) ומפרקות אותו לחלקים שאפשר להפעיל.
 *
 *  חמש השאלות מוצגות **אחת בכל פעם**, 30 שניות לכל אחת (דרישת הלקוחה).
 *  בסוף הזמן עוברים לבד לשאלה הבאה. (כפתור "עוד 30 שניות" הוסר לבקשת
 *  הלקוחה.) אחרי האחרונה מופיעה השורה המסכמת, והכפתור "גורר" את כל הטקסט
 *  למעלה אל מחוץ למסך - ומתחתיו עולה חלונית הסימולציה.
 *
 *  **סרט הרכבה:** השאלות הן חלקים שנעים בשורה מימין לשמאל. השאלה הנוכחית
 *  עומדת במרכז, גדולה, עם 30 השניות שלה; שאלות שנענו ממשיכות שמאלה עם ✓.
 *  מעבר בהחלקת אצבע (שמאלה = הבאה, ימינה = חזרה), בנגיעה בחלק שעל הסרט,
 *  או בחיצי המקלדת - בלי כפתורי "לשאלה הבאה". בסוף כל החלקים מתחברים
 *  לשורה אחת: המנגנון השלם.
 *
 *  הספירה של 30 השניות מקומית בכוונה: זה קצב קריאה של שאלה, לא טיימר של
 *  שלב. רענון מתחיל את השאלות מההתחלה, וזה בסדר - טיימר השלב (בפינה)
 *  נשמר ב-DB כרגיל.
 */

export interface MechanismTexts {
  title: string;
  intro: string;
  changes_title: string;
  changes: string[];
  questions_title: string;
  questions: string[];
  closing: string[];
  next_label: string;
  /** ההערה מתחת לסרט - איך עוברים בין השאלות. */
  swipe_hint: string;
}

export const MECHANISM_DEFAULTS: MechanismTexts = {
  title: "מרעיון למנגנון",
  intro: "עכשיו לוקחות את הרעיון הגדול ומפרקות אותו לחלקים שאפשר באמת להפעיל.",
  changes_title: "מה משתנה?",
  changes: ["הוראה", "משימה", "סביבה", "תיווך", "זמן", "הערכה"],
  questions_title: "לכל שינוי יש לשאול:",
  questions: [
    "מה אנחנו עושות אחרת?",
    "עבור מי?",
    "מתי?",
    "איך זה נראה בפועל?",
    "ומה אמור להשתנות בעקבות זה?",
  ],
  closing: ["כי: רעיון בלי מנגנון הוא השראה.", "רעיון עם מנגנון — הוא שינוי עומק."],
  next_label: "לסימולציה",
  swipe_hint: "החליקו שמאלה לשאלה הבאה, או ימינה כדי לחזור",
};

/** סמל לכל תחום שינוי. תחום חדש שהלקוחה תוסיף ב-DB יקבל ✨ כברירת מחדל. */
const CHANGE_ICONS: Record<string, IconName> = {
  הוראה: "lightbulb",
  משימה: "marker",
  סביבה: "sun",
  תיווך: "users",
  זמן: "clock",
  הערכה: "star",
};

const QUESTION_SECONDS = 30;
const BELT_MASK = "linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%)";
/** מאיזה מרחק גרירה (פיקסלים) ההחלקה נחשבת מעבר שאלה. */
const SWIPE_PX = 70;
/** משך ה"גרירה" למעלה של כל הטקסט, לפני שחלונית הסימולציה עולה. */
const LIFT_MS = 900;

function Stage7Mechanism({ texts, onDone }: { texts: MechanismTexts; onDone: () => void }) {
  const t = { ...MECHANISM_DEFAULTS, ...texts };
  const total = t.questions.length;
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [lifting, setLifting] = useState(false);
  // כמה האצבע גררה עכשיו - החלקים זזים איתה בזמן אמת
  const [dragDx, setDragDx] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const finished = index >= total;

  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finished]);

  const remainingMs = Math.max(0, QUESTION_SECONDS * 1000 - (now - startedAt));
  const remaining = Math.ceil(remainingMs / 1000);

  /** קפיצה לשאלה (או ל-total = הסיכום). כל שאלה מקבלת שוב 30 שניות מלאות. */
  function goTo(target: number) {
    setIndex(Math.max(0, Math.min(total, target)));
    setStartedAt(Date.now());
    setNow(Date.now());
  }

  // בסוף הזמן - לשאלה הבאה לבד
  useEffect(() => {
    if (!finished && remainingMs <= 0) goTo(index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, finished]);

  // חיצי המקלדת - אותו כיוון כמו ההחלקה (נגישות, ובדיקה במחשב)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !finished) goTo(index + 1);
      else if (e.key === "ArrowRight" && index > 0) goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartRef.current = e.clientX;
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return;
    let dx = e.clientX - dragStartRef.current;
    // אין לאן להמשיך - הסרט "מתנגד" (נע רק מעט)
    if ((dx < 0 && finished) || (dx > 0 && index === 0)) dx /= 4;
    setDragDx(dx);
  }
  function onPointerEnd() {
    if (dragStartRef.current === null) return;
    dragStartRef.current = null;
    const dx = dragDx;
    setDragDx(0);
    // הסרט נע שמאלה: החלקה שמאלה מביאה את השאלה הבאה, ימינה - את הקודמת
    if (dx <= -SWIPE_PX && !finished) goTo(index + 1);
    else if (dx >= SWIPE_PX && index > 0) goTo(index - 1);
  }
  // החלקה ארוכה מספיק היא לא נגיעה: חוסמת את ה"קליק" שבסופה על חלק בסרט
  const movedRef = useRef(false);
  useEffect(() => {
    if (Math.abs(dragDx) > 8) movedRef.current = true;
  }, [dragDx]);

  function lift() {
    if (lifting) return;
    setLifting(true);
    window.setTimeout(onDone, LIFT_MS);
  }

  const dragging = dragStartRef.current !== null && dragDx !== 0;

  return (
    <StageShell
      stage={7}
      kicker="סימולציות"
      icon="camera"
      title={t.title}
      subtitle={t.intro}
      background="deep"
      compactHeader
      tightBottom
      clipContent={false}
      width="normal"
      style={
        lifting
          ? { transform: "translateY(-110%)", opacity: 0, transition: `transform ${LIFT_MS}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${LIFT_MS}ms ease-in` }
          : undefined
      }
      // בזמן השאלות המעבר הוא בהחלקה; הכפתור הראשי מופיע רק כשהמנגנון הורכב
      actions={
        finished ? (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={lift}>
            {t.next_label}
          </GlassButton>
        ) : undefined
      }
    >
      <div
        className={cx(
          "flex w-full max-w-5xl flex-col items-center text-center",
          // ריווח אחיד בין השורות (בקשת הלקוחה, 2026-11-08). בסיכום יש יותר
          // שורות - הרווחים מצטמצמים כדי שהכפתור לא יעלה על המשפט
          finished ? "gap-[1.6vh]" : "gap-[3vh]",
        )}
      >
        {/*
          מה משתנה - ששת התחומים כאריחים, כמו אייקונים של אפליקציות: בועה
          צבעונית עם סמל, והמילה מתחתיה. לא כפתורים ללחיצה - "חומרי הגלם"
          של המנגנון, ולכן בלי נפח של כפתור.
        */}
        <div className="flex flex-col items-center gap-[2vh]">
          <p className="text-ink text-[min(3.4vh,2rem)] font-extrabold">{t.changes_title}</p>
          <ul className="flex flex-wrap justify-center gap-3">
            {t.changes.map((c, i) => {
              const n = (i % 5) + 1;
              return (
                // בלי מסגרת ובלי רקע - רק העיגול והמילה (בקשת הלקוחה)
                <li
                  key={c}
                  className="flex w-[7.25rem] flex-col items-center gap-2"
                  style={{ animation: `pop-in 0.45s ${0.2 + i * 0.08}s var(--ds-ease-spring) both` }}
                >
                  <span
                    aria-hidden="true"
                    className={`bubble bubble--${n} flex h-[min(6vh,3.25rem)] w-[min(6vh,3.25rem)] items-center justify-center text-white`}
                  >
                    <Icon name={CHANGE_ICONS[c] ?? "sparkles"} size={24} />
                  </span>
                  <span className="text-ink text-[min(2.3vh,1.2rem)] leading-none font-extrabold">{c}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* "לכל שינוי יש לשאול" - קצת יותר למטה, רחוק מהאייקונים (בקשת הלקוחה) */}
        {!finished && (
          <p className="text-ink-2 mt-[1.5vh] text-[min(2.8vh,1.5rem)] font-bold">{t.questions_title}</p>
        )}

        {/* סרט ההרכבה - נגרר באצבע ימינה ושמאלה */}
        <div
          className={cx("relative w-full select-none", !finished && "cursor-grab active:cursor-grabbing")}
          style={{
            // בסוף החלקים קטנים - הסרט מתכווץ ומפנה מקום לסיכום
            height: finished ? "min(12vh, 7rem)" : "min(30vh, 17rem)",
            transition: "height 0.75s var(--ds-ease)",
            // pan-y: הדפדפן משאיר לנו את הגרירה האופקית (בלי זה אנדרואיד
            // לוקח אותה לעצמו ושולח pointercancel)
            touchAction: "pan-y",
            // החלקים נבלעים בקצוות, כאילו הסרט ממשיך הלאה (בסוף - לא, כל
            // המנגנון צריך להיראות שלם)
            maskImage: finished ? undefined : BELT_MASK,
            WebkitMaskImage: finished ? undefined : BELT_MASK,
          }}
          onPointerDown={(e) => {
            movedRef.current = false;
            onPointerDown(e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          aria-live="polite"
        >
          {t.questions.map((q, i) => {
            const n = (i % 5) + 1;
            const current = !finished && i === index;
            const done = finished || i < index;
            // מרחק מהמרכז: שלילי = כבר עבר (שמאלה), חיובי = עוד מגיע (ימינה)
            const offset = i - index;
            // בסוף: כל החלקים בשורה אחת צפופה, הראשון מימין - המנגנון השלם
            const dx = finished
              ? ((total - 1) / 2 - i) * 205
              : offset === 0
                ? 0
                : Math.sign(offset) * (330 + (Math.abs(offset) - 1) * 250);
            const scale = finished ? 0.5 : current ? 1 : 0.6;
            return (
              <div
                key={q}
                // נגיעה בחלק שעל הסרט מביאה אותו למרכז - גם כדי לחזור לשאלה שעברה
                role={current ? undefined : "button"}
                tabIndex={current ? undefined : 0}
                aria-label={current ? undefined : `חזרה לשאלה ${i + 1}: ${q}`}
                onClick={current ? undefined : () => !movedRef.current && goTo(i)}
                onKeyDown={(e) => {
                  if (!current && (e.key === "Enter" || e.key === " ")) goTo(i);
                }}
                className={cx(
                  "absolute top-1/2 left-1/2 flex w-[25rem] flex-col items-center justify-center gap-2 rounded-2xl px-6 py-5",
                  !current && "cursor-pointer",
                )}
                style={{
                  transform: `translate(-50%, -50%) translateX(${dx + dragDx}px) scale(${scale})`,
                  transition: dragging ? "none" : "transform 0.75s var(--ds-ease), opacity 0.75s var(--ds-ease)",
                  opacity: current || done ? 1 : 0.55,
                  zIndex: current ? 2 : 1,
                  background: "var(--ds-glass-opaque-raised)",
                  border: `3px solid var(--ds-bubble-${n})`,
                  boxShadow: current
                    ? `0 18px 40px -16px var(--ds-bubble-${n})`
                    : `0 8px 18px -12px var(--ds-bubble-${n})`,
                }}
              >
                {/* מספר החלק - ובסימון ✓ כשנענה */}
                <span
                  className={`bubble bubble--${n} absolute -top-5 flex h-10 w-10 items-center justify-center text-lg font-extrabold text-white`}
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                  aria-hidden="true"
                >
                  {done ? <Icon name="check" size={20} /> : i + 1}
                </span>
                <p
                  className="text-ink text-[min(4.2vh,2.4rem)] leading-tight font-extrabold"
                  aria-current={current ? "step" : undefined}
                >
                  {q}
                </p>

                {/* 30 השניות של השאלה - רק במרכז */}
                {current && (
                  <div className="flex w-full flex-col items-center gap-1.5">
                    <div className="bg-edge-dim h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(remainingMs / (QUESTION_SECONDS * 1000)) * 100}%`,
                          background: `var(--ds-bubble-${n})`,
                          transition: "width 0.25s linear",
                        }}
                      />
                    </div>
                    <span
                      className={cx(
                        "flex items-center gap-1.5 text-base font-bold tabular-nums",
                        remaining <= 5 ? "text-warn" : "text-ink-3",
                      )}
                    >
                      <Icon name="clock" size={15} />
                      {remaining} שניות · שאלה {index + 1} מתוך {total}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ההערה - איך עוברים בין השאלות. בסוף: איך חוזרים */}
        {!finished ? (
          <p className="text-ink-2 flex items-center gap-3 text-[min(2.3vh,1.2rem)] font-bold">
            <span className="text-accent flex" style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite" }}>
              <Icon name="arrowBack" size={22} />
            </span>
            {t.swipe_hint}
            <span className="text-accent flex" style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite reverse" }}>
              <Icon name="arrowNext" size={22} />
            </span>
          </p>
        ) : (
          /* הסיכום - אחרי שכל החלקים התחברו. בכרטיס משלו ובגדול: זה המסר
             של כל המסך, ולא הערת שוליים מתחת לסרט */
          <div
            className="glass glass-brick glass-raised flex flex-col items-center gap-[0.6vh] rounded-2xl px-12 py-[1.8vh]"
            style={{ animation: "pop-in 0.6s 0.5s var(--ds-ease-spring) both" }}
          >
            {t.closing.map((line, i) => (
              <p
                key={i}
                className={cx(
                  "leading-snug",
                  i === t.closing.length - 1
                    ? "glass-title text-[min(4.6vh,2.8rem)]"
                    : "text-ink text-[min(3.2vh,1.9rem)] font-extrabold",
                )}
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </StageShell>
  );
}

export default Stage7Mechanism;
