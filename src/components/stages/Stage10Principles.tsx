import { Fragment } from "react";
import type { Group } from "../../types/group";
import { useClosingPrinciple } from "../../hooks/useClosingPrinciple";
import StageShell from "../StageShell";
import { cleanAiHebrew } from "../../lib/hebrewText";
import { InlineNotice } from "../ui/Feedback";

interface Props {
  workshopId: string;
  myGroup: Group;
}

/**
 * שלב 10 - משפט הסיום של הסדנה (שקף 15 במצגת: "מתוך כל הידע שנצבר ע"י AI
 * בסדנא"). ה-AI מנסח **משפט אחד** מתוך כל מה שהקבוצות יצרו לאורך הסדנה,
 * והוא מוצג זהה בשלושת המסכים - זה הרגע האחרון של האירוע.
 *
 * הניסוח עצמו נעשה ב-Edge Function (supabase/functions/generate-closing-principle)
 * ונשמר במסד, ולכן הוא נוצר פעם אחת ולא משתנה בין המסכים או ברענון.
 *
 * ----------------------------------------------------------------------------
 * העיצוב (נבנה מאפס 2026-11-16, בקשת המפתחת): "פוסטר" הסיום
 * ----------------------------------------------------------------------------
 * כחול מלא, בלי כרטיס. במרכז - המשפט עצמו, גדול ולבן, עם מירכאות ענקיות
 * ודקות באדום-כתום. המילים עולות אחת-אחת, ואחריהן נמתח קו כתום. מאחור
 * שלוש מסגרות מרובעות מקוננות מצטיירות סביב המשפט ו"נושמות" לאט - הפרקטל
 * של הסדנה, ממסגר את מה שנולד ממנה. אין כפתור ואין מה למלא: זה הסוף.
 */

/** משפט לדוגמה - רק בתצוגה המקדימה בשרת הפיתוח (?demoPrinciple=1). */
const DEMO_SENTENCE =
  "שינוי עמוק מתחיל כשמזהים את הדפוס ולא רק את הסימפטום, ובונים לו מנגנון קטן שאפשר להפעיל כבר מחר בכיתה";

/** מירכאות מצוירות (התו של Heebo יוצא זעיר) - שתי "טיפות" חדות באדום-כתום. */
function QuoteMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 90" aria-hidden="true">
      <path d="M70 0 H110 L92 60 Q88 78 70 86 L66 78 Q76 70 78 58 H62 Z" />
      <path d="M18 0 H58 L40 60 Q36 78 18 86 L14 78 Q24 70 26 58 H10 Z" />
    </svg>
  );
}

const WORD_GAP = 0.09;
const WORDS_AT = 0.9;

function Stage10Principles({ workshopId, myGroup }: Props) {
  const real = useClosingPrinciple(workshopId, myGroup.id);
  const demo = import.meta.env.DEV && location.search.includes("demoPrinciple");
  const { sentence, loading, error } = demo
    ? { sentence: DEMO_SENTENCE, loading: false, error: null as string | null }
    : real;

  const text = sentence ? cleanAiHebrew(sentence) : "";
  const words = text.split(/\s+/).filter(Boolean);
  const lineAt = WORDS_AT + words.length * WORD_GAP + 0.5;

  return (
    <StageShell
      stage={10}
      icon="lightbulb"
      // הכותרת הרגילה של כל השלבים - נייבי עם הקו הכתום (בקו של כל הפרויקט)
      title="העיקרון שעולה מהסדנה שלכן"
      background="night"
      width="wide"
      className="s10-main"
      // רקע הסיום (2026-11-16): מדרגות פרקטל של ריבועים בשני הצדדים
      // (המסלול של עשרת השלבים הוסר לבקשת המפתחת) - ישירות ב-main (overlay), מאחורי התוכן
      overlay={
        <div className="s10-bg" aria-hidden="true">
          <div className="s10-stairs s10-stairs--start">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="s10-stairs s10-stairs--end">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      }
    >
      <div className="s10-poster">

        {loading && (
          <p className="s10-wait" role="status">
            <span className="s10-wait__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            מנסח את משפט הסיום...
          </p>
        )}

        {!loading && error && (
          <InlineNotice tone="warn" title="לא הצלחנו לנסח את משפט הסיום">
            {error}
          </InlineNotice>
        )}

        {!loading && text && (
          <blockquote className="s10-quote">
            <p className="s10-sentence" style={{ ["--s10-line-at" as string]: `${lineAt}s` }}>
              <span className="sr-only">{text}</span>
              <span aria-hidden="true">
                {/* מירכאות פותחות וסוגרות - אותה צורה בדיוק, בתוך השורה עצמה,
                    צמודות למילה הראשונה ולאחרונה (בקשת המפתחת 2026-11-16) */}
                <QuoteMark className="s10-qm" style={{ animationDelay: `${WORDS_AT - 0.2}s` }} />{" "}
                {words.map((w, i) => (
                  <Fragment key={i}>
                    <span className="s6-w">
                      <span className="s6-w__in" style={{ animationDelay: `${WORDS_AT + i * WORD_GAP}s` }}>
                        {w}
                      </span>
                    </span>{" "}
                  </Fragment>
                ))}
                <QuoteMark className="s10-qm" style={{ animationDelay: `${lineAt - 0.3}s` }} />
              </span>
            </p>
          </blockquote>
        )}

        {!loading && (
          <p className="s10-foot" style={{ animationDelay: `${lineAt + 0.6}s` }}>
            סיום התהליך · כלל הנתונים נשמרים במערכת
          </p>
        )}
      </div>
    </StageShell>
  );
}

export default Stage10Principles;
