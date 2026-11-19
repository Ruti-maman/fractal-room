import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import StageShell from "../StageShell";
import { ConclusionInHeader } from "../PracticalConclusionBanner";
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
  // 2026-11-16: תואם לחפיסה - מעלה = הבאה, מטה = חזרה (החלקה או גלגלת)
  swipe_hint: "החליקו את הכרטיס למעלה לשאלה הבאה, או למטה כדי לחזור",
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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
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
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && !finished) goTo(index + 1);
      else if ((e.key === "ArrowRight" || e.key === "ArrowDown") && index > 0) goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }
  /*
    "תנועת יד בלי לחיצה" (בקשת המפתחת 2026-11-15): בעכבר, תנועה מהירה מעל
    החפיסה - בלי ללחוץ על הכפתור - מעיפה את הכרטיס כמו החלקה. במסך המגע
    ההחלקה עצמה כבר בלי לחיצה (נגיעה = החלקה). נמדד חלון של רבע שנייה;
    אחרי כל מעבר יש השהיה, כדי שתנועה אחת לא תעיף כמה כרטיסים.
  */
  const hoverCooldownRef = useRef(0);
  /*
    2026-11-16 ("בהחלקה ולא בלחיצה"): התנועה נקלטת בכל המסך ולא רק מעל
    החפיסה, וברגישות גבוהה יותר (70px ברבע-שליש שנייה) - תנועת יד רגילה
    מספיקה, בלי ללחוץ ובלי לכוון בדיוק לכרטיס.
  */
  /*
    2026-11-16 (המפתחת: "רק כשמרחפים על הקלפים - גלגלת למעלה מעיפה למעלה,
    למטה מחזירה למטה; לא בכל העמוד"): גלגלת העכבר מעל החפיסה בלבד. תנועת
    עכבר בלי לחיצה כבר לא מעבירה (בוטל). אחרי כל מעבר - הפסקה קצרה, כדי
    שסיבוב גלגלת אחד לא יעיף כמה כרטיסים.
  */
  const deckRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    if (lifting || Math.abs(e.deltaY) < 4) return;
    const t = performance.now();
    if (t < hoverCooldownRef.current) return;
    hoverCooldownRef.current = t + 700;
    // 2026-11-16 (באג: "מחליקים למעלה וחוזרים אחורה"): בהחלקה של שתי אצבעות
    // על משטח מגע, ובגלגלת כמו באתר שהלקוחה הראתה, דחיפת התוכן למעלה נותנת
    // deltaY חיובי. לכן חיובי = הכרטיס עף למעלה = לשאלה הבאה
    if (e.deltaY > 0 && !finished) goTo(index + 1);
    else if (e.deltaY < 0 && index > 0) goTo(index - 1);
  };
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    // passive: false - כדי לבטל את גלילת הדפדפן מעל החפיסה
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return;
    // החפיסה (2026-11-15): החלקה למעלה או שמאלה = קדימה (ערך שלילי), למטה או
    // ימינה = אחורה. הכיוון הדומיננטי קובע.
    const mx = e.clientX - dragStartRef.current.x;
    const my = e.clientY - dragStartRef.current.y;
    let dx = Math.abs(my) > Math.abs(mx) ? my : mx;
    // אין לאן להמשיך - החפיסה "מתנגדת" (זזה רק מעט)
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

  /*
    2026-11-16 (בקשת המפתחת): במסך הסיכום, נגיעה כפולה בכרטיס מחזירה את
    החפיסה - והכרטיס שנבחר עומד בראשה. זיהוי ידני של שתי נגיעות (ולא
    onDoubleClick), כי על מסך מגע עם touch-action:none הדפדפן לא תמיד
    שולח dblclick.
  */
  const lastTapRef = useRef<{ i: number; t: number } | null>(null);
  function onCardTap(i: number) {
    if (!finished || movedRef.current) return;
    const t = performance.now();
    const last = lastTapRef.current;
    if (last && last.i === i && t - last.t < 400) {
      lastTapRef.current = null;
      goTo(i);
    } else {
      lastTapRef.current = { i, t };
    }
  }

  const dragging = dragStartRef.current !== null && dragDx !== 0;

  // הסצנה של המסך הזה (רקע נייר + במה כחולה) - מסומנת על <html>, כי כפתור
  // החזרה ומספר השלב יושבים מחוץ ל-<main> (stage-scenes.css)
  useEffect(() => {
    // (2026-11-16: חזרה לרקע הכהה המקורי - הסצנה הבהירה כבויה. הלקוחה אישרה את הכהה)
    // s7-split: הבלוק הכחול בצד ימין (stage-scenes.css)
    document.documentElement.setAttribute("data-scene", "s7-split");
    return () => document.documentElement.removeAttribute("data-scene");
  }, []);

  return (
    <StageShell
      stage={7}
      // 2026-11-16 ("עדיין לא אוהבת"): מסך מפוצל - בלוק כחול בצד ימין (3
      // עמודות רשת) עם הכותרת, ההסבר ו"מה משתנה?", והחפיסה על הנייבי משמאל.
      // הכותרת של StageShell מוסתרת (s7-split ב-stage-scenes.css) - היא
      // נבנית כאן בתוך הבלוק. הבלוק עצמו: sc-block--a לפי data-scene.
      className="s7-split-main"
      hideHeader
      icon="camera"
      background="deep"
      compactHeader
      tightBottom
      clipContent={false}
      width="full"
      style={
        lifting
          ? { transform: "translateY(-110%)", opacity: 0, transition: `transform ${LIFT_MS}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${LIFT_MS}ms ease-in` }
          : undefined
      }
    >
      {/* "המסקנה שלנו" למעלה במרכז, כמו בכל העמודים (דרישת הלקוחה) */}
      <div className="s7-top">
        <ConclusionInHeader />
        {/* הכותרת על הנייבי, מעל החפיסה (בקשת המפתחת 2026-11-16) */}
        <h1 className="s7-title">{t.title}</h1>
        {/* ההסבר מתחת לכותרת, על הנייבי (בקשת המפתחת 2026-11-16) */}
        <p className="s7-intro">{t.intro}</p>
      </div>
      <div className="s7-split">
        {/* הבלוק הלבן (שמאל): כותרת, הסבר, וששת התחומים בשתי עמודות */}
        <aside className={cx("s7-panel", finished && "is-done")}>
          <div className="s7-panel__changes">
            <p className="s7-panel__label">{t.changes_title}</p>
            <ul className="s7-list">
              {t.changes.map((c, i) => (
                <li
                  key={c}
                  className="s7-list__item"
                  style={{ animationDelay: `${0.6 + i * 0.08}s`, ["--pulse-at" as string]: `${1.2 + i * 0.45}s` }}
                >
                  <span aria-hidden="true" className="s7-chg__icon">
                    <Icon name={CHANGE_ICONS[c] ?? "sparkles"} size={26} />
                  </span>
                  <span className="s7-list__label">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* הבמה: השאלה, החפיסה וההערה - ממורכזות על הנייבי */}
        <section className={cx("s7-stage", finished ? "s7-stage--done gap-[2.4vh]" : "gap-[3vh]")}>
        {!finished && <p className="s7-ask">{t.questions_title}</p>}

        {/* סרט ההרכבה - נגרר באצבע ימינה ושמאלה */}
        <div
          ref={deckRef}
          className={cx("s7-deck relative w-full select-none", finished && "is-finished", !finished && "cursor-grab active:cursor-grabbing")}
          style={{
            // בסוף החלקים קטנים - הסרט מתכווץ ומפנה מקום לסיכום
            height: finished ? "min(12vh, 7rem)" : "min(34vh, 20rem)",
            transition: "height 0.75s var(--ds-ease)",
            // pan-y: הדפדפן משאיר לנו את הגרירה האופקית (בלי זה אנדרואיד
            // לוקח אותה לעצמו ושולח pointercancel)
            // none: גם החלקה אנכית שלנו (החפיסה) - אנדרואיד לא לוקח אותה לגלילה
            touchAction: "none",
            // החלקים נבלעים בקצוות, כאילו הסרט ממשיך הלאה (בסוף - לא, כל
            // המנגנון צריך להיראות שלם)
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
          {/* 2026-11-16 ("עוד עניין, משהו שזז"): בסיכום - "חוט" כתום נמתח מתחת
              לשורת הכרטיסים, ונקודת אור רצה עליו בלי הפסקה: המנגנון מחובר
              ועובד. s7-wire ב-editorial.css */}
          {finished && (
            <span className="s7-wire" aria-hidden="true">
              <span className="s7-wire__spark" />
            </span>
          )}
          {t.questions.map((q, i) => {
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
            /*
              החפיסה (2026-11-15, בהשראת markeru): השאלות מונחות זו מתחת לזו.
              הנוכחית למעלה; כל אחת שמתחתיה מבצבצת כ"מדרגה" - נמוכה וצרה
              יותר - כך שרואים כמה נשארו. שאלה שנענתה עפה למעלה ונעלמת;
              חזרה מורידה אותה בחזרה על החפיסה. בגרירה הכרטיס זז עם האצבע.
            */
            const depth = Math.max(0, offset);
            // בסיכום - הכרטיס האחרון (הגדול, "ומה אמור להשתנות") בכתום, שונה מכולם
            const highlight = finished && i === total - 1;
            const deckTransform = finished
              ? `translate(-50%, -50%) translateX(${dx}px) scale(0.5)`
              : offset < 0
                ? // עפה למעלה (והקודמת יורדת בחזרה כשגוררים למטה)
                  `translate(-50%, -50%) translateY(calc(-150% + ${offset === -1 ? Math.max(0, dragDx) : 0}px)) rotate(-7deg)`
                : `translate(-50%, -50%) translateY(${depth * 22 + (current ? Math.min(0, dragDx) : 0)}px) scale(${1 - depth * 0.07}) rotate(${current ? Math.min(0, dragDx) / 25 : 0}deg)`;
            return (
              <div
                key={q}
                // מעבר בין שאלות רק בהחלקת אצבע (בקשת המפתחת 2026-11-15) - בלי
                // נגיעה בכרטיס. במקלדת: החיצים (ראו למעלה)
                className={cx(
                  // sc-light: כרטיס בהיר - על הרקע הכחול הטקסט בו נשאר נייבי.
                  // s7-q: כרטיס לבן חד, מספר ענק ודק, פס זמן כתום (editorial.css)
                  "sc-light s7-q absolute top-1/2 left-1/2 flex w-[25rem] flex-col items-start justify-center gap-2 px-7 py-6",
                  current && "is-current",
                  done && "is-done",
                  // התחתונה בחפיסה - הפס הכתום שמבצבץ בבסיס (כמו הפס הצבעוני באתר)
                  !finished && i === total - 1 && "is-base",
                  // הכרטיסים שמתחת לנוכחי - שכבות ריקות (רק המדרגה שלהם נראית)
                  !finished && offset > 0 && "is-under",
                  finished && "cursor-pointer",
                  highlight && "s7-q--last",
                )}
                onPointerUp={() => onCardTap(i)}
                style={{
                  // הקלפים שבצד מסתובבים לעבר המרכז - כמו תיבות על סרט נע
                  transform: deckTransform,
                  transition: dragging ? "none" : "transform 0.75s var(--ds-ease), opacity 0.75s var(--ds-ease)",
                  opacity: finished || offset >= 0 ? 1 : offset === -1 && dragDx > 0 ? 1 : 0,
                  zIndex: finished ? 1 : offset < 0 ? 20 : 10 - depth,
                  background: highlight ? "#f25740" : "#ffffff",
                  boxShadow: "none",
                }}
              >
                {/* מספר החלק - ובסימון ✓ כשנענה */}
                {/* מספר ענק ודק באדום-כתום; כשנענה - ✓ */}
                <span className="s7-q__n" aria-hidden="true">
                  {done ? <Icon name="check" size={34} /> : String(i + 1).padStart(2, "0")}
                </span>
                <p
                  className={cx(
                    "text-start text-[min(4.2vh,2.4rem)] leading-tight font-extrabold",
                    highlight ? "text-white" : "text-ink",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {q}
                </p>

                {/* 30 השניות של השאלה - רק במרכז */}
                {current && (
                  <div className="flex w-full flex-col items-center gap-1.5">
                    <div className="s7-q__track">
                      <div
                        className="s7-q__fill"
                        style={{
                          width: `${(remainingMs / (QUESTION_SECONDS * 1000)) * 100}%`,
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
          <p className="text-ink-2 mt-[3vh] flex items-center gap-3 text-[min(2.3vh,1.2rem)] font-bold">
            {/* חצים למעלה ולמטה (מסובבים ברבע סיבוב), כמו תנועת החפיסה */}
            <span className="text-accent flex" style={{ transform: "rotate(90deg)" }}>
              <span className="flex" style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite" }}>
                <Icon name="arrowNext" size={22} />
              </span>
            </span>
            {t.swipe_hint}
            <span className="text-accent flex" style={{ transform: "rotate(90deg)" }}>
              <span className="flex" style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite reverse" }}>
                <Icon name="arrowBack" size={22} />
              </span>
            </span>
          </p>
        ) : (
          /* הסיכום - אחרי שכל החלקים התחברו. בכרטיס משלו ובגדול: זה המסר
             של כל המסך, ולא הערת שוליים מתחת לסרט */
          // בלי כרטיס: ישר על הכחול, בלבן גדול, והשורה האחרונה עם קו כתום
          <div className="s7-close">
            {t.closing.map((line, i) => (
              <p
                key={i}
                className={i === t.closing.length - 1 ? "s7-close__big" : "s7-close__line"}
                style={{ animationDelay: `${0.5 + i * 0.35}s` }}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        {finished && (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={lift} className="mt-[2vh]">
            {t.next_label}
          </GlassButton>
        )}
        </section>
      </div>
    </StageShell>
  );
}

export default Stage7Mechanism;
