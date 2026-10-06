import { useState } from "react";
import type { Stage5Content, SolutionOption } from "../../types/stage5Content";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import GlassModal from "../ui/GlassModal";
import GameTile, { LevelBadge } from "../ui/GameTile";
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
      {/* טבעות שמתפרצות - רק בתשובה נכונה */}
      {ok &&
        [0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="border-accent absolute inset-0 rounded-full border-2"
            style={{
              animation: `ring-out 1.1s ${i * 180}ms var(--ds-ease) both`,
            }}
          />
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
          "glass relative flex h-24 w-24 items-center justify-center rounded-full",
          ok ? "glass-active" : "text-danger",
        )}
        style={{
          animation: "bounce-in 0.55s var(--ds-ease-spring) both",
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
            <Icon name="sparkles" size={16} />
          </span>
        ))}
    </div>
  );
}

const OPTION_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

/** סצנה לכל אפשרות. שונות בצורה בלבד - אף אחת לא "מרמזת" שהיא הנכונה. */

function Stage5Solutions({ content, onAdvance }: Props) {
  const [chosen, setChosen] = useState<SolutionOption | null>(null);

  return (
    <StageShell
      stage={5}
      kicker="גיבוש פתרונות"
      icon="lightbulb"
      title="איזו דרך פתרון בוחרות?"
      subtitle="קראו את ארבע האפשרויות, דונו ביניכן, ובחרו את זו שנראית לכן הנכונה."
      background="tide"
      // "normal" ולא "wide": ברוחב מלא מד ההתקדמות והטיימר שבפינות עלו על האריחים
      width="normal"
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
          onClose={chosen?.correct ? undefined : () => setChosen(null)}
          cancelLabel="סגירה"
          dismissable={!chosen?.correct}
        >
          <p
            className="text-ink text-2xl leading-relaxed font-bold"
            style={{ animation: "fade-up 0.5s 0.35s var(--ds-ease) both" }}
          >
            {chosen?.explanation}
          </p>
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
      <ul className="grid min-h-0 w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2 lg:gap-5 pb-4">
        {content.options.map((opt, i) => (
          <li key={i} className="flex min-h-0">
            <GameTile
              title={`אפשרות ${OPTION_LETTERS[i] ?? i + 1}`}
              plain
              /*
                כל ארבעת התגים **באותו צבע**, בכוונה. ניסיון לתת לכל אפשרות
                בועה בצבע אחר יצר בדיוק את הבעיה שהשלב הזה חייב להימנע
                ממנה: אלמוג נקרא כ"שגוי" וענבר כ"אזהרה", כלומר הצבע עצמו
                רמז לתשובה. הצבעוניות של המסך מגיעה מהרקע ומהסצנות.
              */
              badge={<LevelBadge value={OPTION_LETTERS[i] ?? i + 1} label="" size={60} />}
              onClick={() => setChosen(opt)}
              className="h-full"
              footer={
                <span className="flex items-center gap-2">
                  לבחירה
                  <Icon name="arrowNext" size={16} />
                </span>
              }
              style={{
                animation: `glass-in var(--ds-dur-slow) ${i * 90}ms var(--ds-ease) both`,
              }}
            >
              <p className="text-ink text-xl leading-snug font-bold sm:text-2xl">
                {opt.label}
              </p>
            </GameTile>
          </li>
        ))}
      </ul>
    </StageShell>
  );
}

export default Stage5Solutions;
