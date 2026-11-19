import { useState } from "react";
import type { ExplanationLine, Stage5Content, SolutionOption } from "../../types/stage5Content";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import GlassModal from "../ui/GlassModal";
import { cx } from "../../lib/cx";

interface Props {
  content: Stage5Content;
  onAdvance: () => void;
}

/**
 * שלב 5 - גיבוש פתרונות (שקף 9 במצגת). המנגנון לא השתנה: ארבע אפשרויות,
 * לחיצה פותחת פופ-אפ - שגויה מסבירה למה ומאפשרת לנסות שוב, נכונה מסבירה
 * ומשאירה את המעבר לטיימר.
 *
 * ----------------------------------------------------------------------------
 * הכלל הפדגוגי שמכתיב את העיצוב
 * ----------------------------------------------------------------------------
 * ארבעת הכרטיסים חייבים להיראות **זהים לחלוטין**. כל רמז ויזואלי לאיזו
 * אפשרות נכונה - צבע, מיקום בולט, אייקון אחר, אפילו צל חזק יותר - הורס את
 * התרגיל. לכן ההבדל היחיד ביניהם הוא הטקסט, ואפילו אות הסימון (א/ב/ג/ד)
 * נשארת באותו משקל ויזואלי בכולם.
 *
 * מה כן השתנה: הכרטיסים סודרו ברשת גמישה שיורדת לעמודה אחת במסך צר במקום
 * רוחב קבוע של 26rem שגלש, ולכל כרטיס נוסף מספור - כדי שקבוצה תוכל לדבר
 * על "אפשרות ב'" בקול בלי להצביע על המסך.
 */

/*
 * ----------------------------------------------------------------------------
 *  רגע התשובה
 * ----------------------------------------------------------------------------
 *  הפופ-אפ הקודם היה אייקון סטטי בעיגול. כאן יש רצף קצר שנקרא לפי הסדר:
 *    1. טבעות שמתפרצות החוצה  - "משהו קרה"
 *    2. הסימן נמשך בקו          - "מה קרה"
 *    3. ניצוצות + הכפתור        - "מה עכשיו"
 *
 *  הכל פעם אחת בלבד, בלי לולאות: זו הכרזה, לא מצב.
 */

/** שמונה ניצוצות שמתפזרים מהמרכז. זוויות קבועות, לא אקראיות. */
const SPARKS = Array.from({ length: 8 }, (_, i) => ({
  angle: i * 45,
  distance: i % 2 === 0 ? 78 : 58,
  delay: 320 + (i % 4) * 45,
}));

/** הסימן המונפש. `ok` קובע אם זה וי מתפרץ או איקס עם רעידה. */
function AnswerMark({ ok }: { ok: boolean }) {
  return (
    <div
      className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center"
      style={ok ? undefined : { animation: "shake-x 0.5s ease-in-out" }}
    >
      {/* מסגרות מעוין שמתפרצות - רק בתשובה נכונה. ריבוע מסובב ב-45 מעלות
          בעטיפה נפרדת, כי האנימציה עצמה דורסת את ה-transform של האלמנט */}
      {ok &&
        [0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute inset-[15%]"
            style={{ transform: "rotate(45deg)" }}
          >
            <span
              className="border-accent absolute inset-0 border-2"
              style={{
                animation: `ring-out 1.1s ${i * 180}ms var(--ds-ease) both`,
              }}
            />
          </span>
        ))}

      {/* הילה רכה מאחורי הסימן */}
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-0 rounded-full blur-xl",
          ok ? "bg-glow" : "bg-danger-fill",
        )}
        style={{ animation: "halo-once 0.9s var(--ds-ease) both" }}
      />

      {/* העיגול עצמו */}
      <span
        className={cx(
          "glass relative flex h-24 w-24 items-center justify-center diamond",
          ok ? "glass-active" : "text-danger",
        )}
        style={{
          animation: "bounce-in 0.55s var(--ds-ease-spring) both",
          // ה-× של "לא הפעם" בכתום של האתר (בקשת המפתחת 2026-11-16) -
          // ה-skin צבע אותו נייבי
          ...(ok ? {} : { color: "#f25740" }),
        }}
      >
        <svg
          viewBox="0 0 48 48"
          className="h-12 w-12"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ok ? (
            // הווי נמשך בקו אחד. `--dash` הוא אורך הנתיב בערך, וזה מה
            // שגורם לו להיראות כאילו הוא נכתב עכשיו ולא הופיע מוכן.
            <path
              d="M12 25l8 8 16-18"
              style={{
                ["--dash" as string]: 46,
                strokeDasharray: 46,
                animation: "draw-stroke 0.45s 0.25s var(--ds-ease) both",
              }}
            />
          ) : (
            <>
              <path
                d="M15 15l18 18"
                style={{
                  ["--dash" as string]: 26,
                  strokeDasharray: 26,
                  animation: "draw-stroke 0.3s 0.15s var(--ds-ease) both",
                }}
              />
              <path
                d="M33 15L15 33"
                style={{
                  ["--dash" as string]: 26,
                  strokeDasharray: 26,
                  animation: "draw-stroke 0.3s 0.32s var(--ds-ease) both",
                }}
              />
            </>
          )}
        </svg>
      </span>

      {/* ניצוצות שמתפזרים - רק בתשובה נכונה */}
      {ok &&
        SPARKS.map((spark) => (
          <span
            key={spark.angle}
            aria-hidden="true"
            className="text-accent-pale absolute"
            style={{
              ["--angle" as string]: `${spark.angle}deg`,
              ["--distance" as string]: `${spark.distance}px`,
              animation: `spark-out 0.85s ${spark.delay}ms var(--ds-ease) both`,
            }}
          >
            <Icon name="star" size={16} filled />
          </span>
        ))}
    </div>
  );
}

const OPTION_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

/** סצנה לכל אפשרות. שונות בצורה בלבד - אף אחת לא "מרמזת" שהיא הנכונה. */

/** ברירות מחדל לפי התסריט של הלקוחה - אם content עוד לא עודכן ב-DB. */
const DEFAULT_INTRO_LINES = ["יש בעיה.", "יש תמונת מצב.", "עכשיו צריך שינוי."];
const DEFAULT_TITLE = "אבל רגע, איזה שינוי?";

/** הטקסט שבפופ-אפ: שורות מהתוכן אם יש, אחרת ההסבר הקצר הישן. */
function explanationLines(opt: SolutionOption): ExplanationLine[] {
  if (opt.explanation_lines?.length) return opt.explanation_lines;
  return [{ text: opt.explanation, bold: true }];
}

function Stage5Solutions({ content, onAdvance }: Props) {
  const [chosen, setChosen] = useState<SolutionOption | null>(null);
  const introLines = content.intro_lines?.length ? content.intro_lines : DEFAULT_INTRO_LINES;
  const lines = chosen ? explanationLines(chosen) : [];
  // ההסבר של התשובה הנכונה ארוך (כ-13 שורות) - כתב קטן יותר כדי שהפופ-אפ
  // ייכנס למסך בלי גלילה
  const longText = lines.length > 5;

  return (
    <StageShell
      stage={5}
      // בלי התגית "גיבוש פתרונות" (בקשת המפתחת 2026-11-15)
      icon="lightbulb"
      title={content.title || DEFAULT_TITLE}
      subtitle={introLines.join(" ")}
      background="tide"
      // "normal" ולא "wide": ברוחב מלא מד ההתקדמות והטיימר שבפינות עלו על האריחים
      // "full": ארבעה כרטיסים לרוחב (מאוזנים) בשורה אחת - בקשת הלקוחה 2026-11-16.
      // השורה יושבת גבוה, הרחק מהפאנלים שבפינות התחתונות
      width="full"
      overlay={
        <GlassModal
          open={Boolean(chosen)}
          tone={chosen?.correct ? "ok" : "danger"}
          title={chosen?.correct ? "בדיוק כך" : "לא הפעם"}
          visual={chosen ? <AnswerMark ok={chosen.correct} /> : null}
          /*
           * בתשובה נכונה יש עכשיו "המשך" ולא רק המתנה לטיימר.
           * זה שינוי מההחלטה הקודמת ("כשצודקים אין כפתור") לפי בקשה
           * מפורשת של הלקוחה: קבוצה שכבר ענתה נכון לא אמורה לשבת מול
           * מסך נעול עד שהשעון ייגמר. הטיימר עדיין מעביר לבד אם לא
           * לוחצים - הכפתור רק מאפשר להקדים.
           */
          confirmLabel={chosen?.correct ? "המשך" : "ננסה שוב"}
          onConfirm={chosen?.correct ? onAdvance : () => setChosen(null)}
          // בלי "סגירה" ובלי ×: שניהם עשו בדיוק מה ש"ננסה שוב" עושה, ושני
          // כפתורים עם אותה פעולה רק מבלבלים (דרישת הלקוחה)
          onClose={undefined}
          dismissable={false}
        >
          {/* הכותרת כתובה על כפתור הבחירה, וכאן - הטקסט הרץ (לבקשת הלקוחה) */}
          <p className="text-accent-soft mb-3 text-xl font-extrabold">{chosen?.label}</p>
          <div
            className={cx("text-ink flex flex-col", longText ? "gap-0.5" : "gap-2")}
            style={{ animation: "fade-up 0.5s 0.35s var(--ds-ease) both" }}
          >
            {lines.map((line, i) => (
              <p
                key={i}
                className={cx(
                  "leading-snug",
                  longText ? "text-lg" : "text-2xl",
                  line.bold ? "font-extrabold" : "text-ink-2",
                )}
              >
                {line.text}
              </p>
            ))}
          </div>
        </GlassModal>
      }
    >
      {/*
        ארבעה אריחי משחק, בדיוק כמו לוח בחירת משחק: סצנה מאוירת בראש
        האריח, תג עגול עם אות האפשרות על הגבול, והטקסט בגוף.

        הכלל הפדגוגי עדיין חולש על הכל - **הארבעה חייבים להיראות זהים**.
        לכן האריחים חלקים, בלי סצנות מאוירות: הסצנות נקראו כ"סימנים" על
        האריח, והן עלולות לרמוז שאפשרות אחת שונה מהאחרות.
      */}
      {/* הרשת ממלאת בדיוק את הגובה הפנוי (שתי שורות שוות), כדי שכל
          ארבעת האריחים ייראו בלי גלילה גם במסך נמוך - האריחים מתכווצים
          במקום לגלוש. בדיון על ארבע אפשרויות חייבים לראות את כולן יחד. */}
      {/* 2026-11-15 (בקשת המפתחת: "לעצב מחדש"): לוח עיתונאי של ארבע משבצות
          לבנות על הכחול, עם קווים דקים ביניהן. בכל משבצת: אות ענקית ודקה
          באדום-כתום, "אפשרות X" קטן, שם האפשרות גדול, ו"לבחירה" עם חץ
          אלכסוני דק. **ארבעתן זהות לגמרי** - הכלל הפדגוגי: שום משבצת לא
          רומזת על התשובה. כל משבצת נחשפת מכיוון אחר. s5-* ב-editorial.css */}
      <ul className="s5-board">
        {content.options.map((opt, i) => (
          <li
            key={i}
            className="s5-cell"
            style={
              {
                // "חלוקת קלפים": כולם יוצאים מערימה אחת באמצע ונפרסים למקומם
                // (RTL - הראשון מימין, ולכן הוא מתחיל משמאלו). s5-deal ב-editorial.css
                "--deal-x": `${-((content.options.length - 1) / 2 - i) * 112}%`,
                "--deal-r": `${((content.options.length - 1) / 2 - i) * 7}deg`,
                animationDelay: `${0.35 + i * 0.13}s`,
              } as React.CSSProperties
            }
          >
            <button type="button" className="s5-opt" onClick={() => setChosen(opt)}>
              <span className="s5-opt__letter" aria-hidden="true">
                {OPTION_LETTERS[i] ?? i + 1}
              </span>
              <span className="s5-opt__kicker">{`אפשרות ${OPTION_LETTERS[i] ?? i + 1}`}</span>
              <span className="s5-opt__label">{opt.label}</span>
              <span className="s5-opt__go">
                לבחירה
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 5 L5 19 M5 8.5 L5 19 L15.5 19" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </StageShell>
  );
}

export default Stage5Solutions;
