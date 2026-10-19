import { useEffect, useState } from "react";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
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
 *  בסוף הזמן עוברים לבד לשאלה הבאה, ואפשר להקדים בכפתור. (כפתור "עוד 30
 *  שניות" הוסר לבקשת הלקוחה.) אחרי האחרונה מופיעה השורה המסכמת, והכפתור "גורר" את כל הטקסט
 *  למעלה אל מחוץ למסך - ומתחתיו עולה חלונית הסימולציה.
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
};

const QUESTION_SECONDS = 30;
/** משך ה"גרירה" למעלה של כל הטקסט, לפני שחלונית הסימולציה עולה. */
const LIFT_MS = 900;

function Stage7Mechanism({ texts, onDone }: { texts: MechanismTexts; onDone: () => void }) {
  const total = texts.questions.length;
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [lifting, setLifting] = useState(false);
  const finished = index >= total;

  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finished]);

  const remainingMs = Math.max(0, QUESTION_SECONDS * 1000 - (now - startedAt));
  const remaining = Math.ceil(remainingMs / 1000);

  function nextQuestion() {
    setIndex((i) => i + 1);
    setStartedAt(Date.now());
    setNow(Date.now());
  }

  // בסוף הזמן - לשאלה הבאה לבד
  useEffect(() => {
    if (!finished && remainingMs <= 0) nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, finished]);

  function lift() {
    if (lifting) return;
    setLifting(true);
    window.setTimeout(onDone, LIFT_MS);
  }

  return (
    <StageShell
      stage={7}
      kicker="סימולציות"
      icon="camera"
      title={texts.title}
      subtitle={texts.intro}
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
      actions={
        finished ? (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={lift}>
            {texts.next_label}
          </GlassButton>
        ) : (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={nextQuestion}>
            {index === total - 1 ? "סיימנו את השאלות" : "לשאלה הבאה"}
          </GlassButton>
        )
      }
    >
      <div className="glass glass-brick glass-raised flex w-full max-w-3xl flex-col items-center gap-[1.6vh] rounded-2xl px-10 py-[2.6vh] text-center">
        {/* מה משתנה - שישה תחומים, באותו משקל */}
        <div className="flex flex-col items-center gap-[1vh]">
          <p className="text-ink text-[min(3.2vh,1.9rem)] font-extrabold">{texts.changes_title}</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {texts.changes.map((c, i) => (
              <li
                key={c}
                className="glass glass-raised glass-pill text-ink px-5 py-1.5 text-[min(2.6vh,1.35rem)] font-bold"
                style={{ animation: `pop-in 0.45s ${0.2 + i * 0.08}s var(--ds-ease-spring) both` }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-edge-dim h-px w-2/3" aria-hidden="true" />

        {!finished ? (
          <div className="flex w-full flex-col items-center gap-[1.2vh]">
            <p className="text-ink-2 text-[min(2.6vh,1.35rem)] font-bold">{texts.questions_title}</p>

            {/* השאלה הנוכחית - key מחליף אנימציה בכל שאלה */}
            <p
              key={index}
              className="glass-title text-[min(5.2vh,3rem)] leading-tight"
              style={{ animation: "fade-up 0.5s var(--ds-ease) both" }}
            >
              {texts.questions[index]}
            </p>

            {/* כמה זמן נשאר לשאלה הזו */}
            <div className="flex w-full max-w-md flex-col items-center gap-1.5">
              <div className="bg-edge-dim h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full"
                  style={{
                    width: `${(remainingMs / (QUESTION_SECONDS * 1000)) * 100}%`,
                    transition: "width 0.25s linear",
                  }}
                />
              </div>
              <span className={cx("flex items-center gap-1.5 text-base font-bold tabular-nums", remaining <= 5 ? "text-warn" : "text-ink-3")}>
                <Icon name="clock" size={15} />
                {remaining} שניות
              </span>
            </div>

            {/* נקודות התקדמות - שאלה כמה מתוך כמה */}
            <ol className="flex gap-2" aria-label={`שאלה ${index + 1} מתוך ${total}`}>
              {texts.questions.map((_, i) => (
                <li
                  key={i}
                  className={cx(
                    "h-2.5 rounded-full transition-all duration-300",
                    i === index ? "bg-accent w-7" : i < index ? "bg-accent-soft w-2.5" : "bg-edge-dim w-2.5",
                  )}
                />
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[0.8vh]" style={{ animation: "fade-up 0.6s var(--ds-ease) both" }}>
            {texts.closing.map((line, i) => (
              <p
                key={i}
                className={cx(
                  "leading-snug",
                  i === texts.closing.length - 1 ? "glass-title text-[min(4.6vh,2.6rem)]" : "text-ink text-[min(3.4vh,2rem)] font-extrabold",
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
