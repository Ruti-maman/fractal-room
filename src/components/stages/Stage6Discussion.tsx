import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Stage6Content, Stage6Line } from "../../types/stage6Content";
import type { Group } from "../../types/group";
import { useDiscussionStart } from "../../hooks/useDiscussionStart";
import StageShell from "../StageShell";
import Hourglass from "../Hourglass";
import type { Tip } from "../TipPopups";
import TipChat from "../TipChat";
import FractalFullscreen from "../FractalFullscreen";
import { GlassButton } from "../ui/Glass";
import { cx } from "../../lib/cx";

/*
 * ============================================================================
 *  שלב 6 - דיון קבוצתי מונחה (שקף 10 במצגת)
 * ============================================================================
 *
 *  שני מסכים, לפי התסריט של הלקוחה:
 *
 *  1. **הוראות** - כרטיס עם השאלה, הזמן והתוצר הנדרש, "כלל הפרקטל" באותו
 *     עיצוב כמו בשלב 2 (FractalSentence), וחמשת הטיפים לדיון טוב בפופ-אפ
 *     בצורת צ'אט של דיון (TipChat). הפרקטל נכנס רק אחרי שסוגרים
 *     את הפופ-אפ, לא במקביל (דרישת הלקוחה). הכפתור "בואו נדבר על זה"
 *     עובר למסך הדיון.
 *  2. **דיון** - טבעת טיימר גדולה במרכז, 10 דקות לעריכת הדיון.
 *
 *  **שני טיימרים נפרדים** (החלטת הלקוחה): טיימר הדיון במרכז הוא תזכורת
 *  לקבוצה, וטיימר השלב בפינה ממשיך כרגיל ומעביר לשלב 7 בסופו. לכן משך
 *  השלב ב-DB חייב להיות ארוך מהדיון (ראו supabase/stage6_discussion_texts.sql).
 *
 *  זמן תחילת הדיון נשמר ב-DB (useDiscussionStart) - רענון באמצע הדיון חוזר
 *  למסך הטיימר עם הזמן שנותר באמת, בלי ספירה מקומית.
 */

/*
  ברירות מחדל - הנוסח של הלקוחה מהתסריט. משמשות רק כשאין טקסט ב-DB
  (ראו supabase/stage6_discussion_texts.sql).
*/
const DEFAULT_INTRO: Stage6Line[] = [
  { text: "אז מה אנחנו יכולות לשנות — כדי שמשהו טוב יותר יוכל לקרות?", bold: true },
  { text: "יש לכן 10 דקות", bold: true },
  { text: "תוצר אחד ברור:" },
  { text: "כיוון לשינוי פדגוגי עמוק ומובנה", bold: true },
  { text: "שמתייחס לדפוס שזיהיתן — ולא רק לסימפטום." },
];

const DEFAULT_TIPS: Tip[] = [
  { title: "קודם מבינות. אחר כך פותרות.", text: "אל תקפצו לפתרון בדקה הראשונה." },
  { title: "תתווכחו עם הרעיון, לא עם מי שהציעה אותו.", text: "רעיון טוב שורד כמה שאלות קשות." },
  { title: "חפשו את נקודת המינוף.", text: "מה שינוי קטן יחסית שיכול לייצר שינוי גדול?" },
  { title: "אל תסתפקו ב\"צריך\".", text: "\"צריך לתת יותר יחס\" זה לא פתרון. מה בדיוק עושים אחרת?" },
  { title: "אם כולן מסכימות מיד — תעצרו.", text: "כנראה עוד לא עשיתן מספיק זום." },
];

const DEFAULTS = {
  start_label: "בואו נדבר על זה",
  tips_title: "טיפים לדיון טוב",
  tips_confirm_label: "הבנו!",
  fractal_title: "כלל הפרקטל",
  fractal_text: "תשובה טובה לא סוגרת את הדיון. היא פותחת עוד שכבה.",
  discussion_minutes: 10,
  discussion_label: "זמן לעריכת הדיון",
};

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage6Content;
  onAdvance: () => void;
}

function Stage6Discussion({ workshopId, myGroup, content, onAdvance }: Props) {
  const { startedAt, loading, start } = useDiscussionStart(workshopId, myGroup.id);
  const t = { ...DEFAULTS, ...content };
  const intro = content.intro_lines?.length ? content.intro_lines : DEFAULT_INTRO;
  const tips = content.tips?.length ? content.tips : DEFAULT_TIPS;

  // דרישת הלקוחה: קודם הטיפים בחלונית פופ-אפ (צ'אט של דיון),
  // ורק כשסוגרים אותה נכנס כלל הפרקטל - לא במקביל.
  const [tipsOpen, setTipsOpen] = useState(false);
  const [fractalReady, setFractalReady] = useState(false);
  /** כלל הפרקטל על מסך מלא - פעם אחת, אחרי הסגירה הראשונה של הטיפים. */
  const [fractalShowing, setFractalShowing] = useState(false);
  useEffect(() => {
    if (loading || startedAt) return;
    // רגע קצר לפני הקפיצה, כדי שהשאלה בכרטיס תספיק להיראות מאחור
    const id = window.setTimeout(() => setTipsOpen(true), 900);
    return () => window.clearTimeout(id);
  }, [loading, startedAt]);

  function closeTips() {
    setTipsOpen(false);
    // "כלל הפרקטל על מסך מלא" (בקשת הלקוחה, 2026-11-08) - רק בפעם הראשונה;
    // פתיחה חוזרת של הטיפים לא מריצה אותו שוב
    if (!fractalReady && !startedAt) setFractalShowing(true);
    setFractalReady(true);
  }

  /* הפופ-אפ ב-portal: StageShell מונפש ב-transform, ו-fixed בתוך הורה עם
     transform נמדד ביחס להורה ולא לחלון (באג 6 ב-CLAUDE.md). משותף לשני
     המסכים - אפשר לפתוח אותו שוב גם באמצע הדיון. */
  const tipsPopup = createPortal(
    <TipChat open={tipsOpen} onClose={closeTips} title={t.tips_title} tips={tips} confirmLabel={t.tips_confirm_label} />,
    document.body,
  );

  // פותח שוב את הטיפים אחרי שנסגרו (דרישת הלקוחה)
  const tipsButton = (
    <GlassButton size="lg" icon="lightbulb" onClick={() => setTipsOpen(true)}>
      {t.tips_title}
    </GlassButton>
  );

  /*
    2026-11-16 (בקשת המפתחת): בכל כניסה למסך הדיון שעון החול מתחיל מ-10
    דקות מחדש - גם אחרי רענון או חזרה לשלב. לכן הספירה מתחילה מרגע
    ההגעה למסך הזה, ולא מהזמן השמור ב-DB (שעדיין קובע לאיזה מסך חוזרים).
  */
  const [enteredAt, setEnteredAt] = useState<string | null>(null);
  useEffect(() => {
    if (startedAt && !enteredAt) setEnteredAt(new Date().toISOString());
  }, [startedAt, enteredAt]);

  // עד שידוע אם הדיון כבר התחיל - לא מציגות אף מסך, כדי שרענון באמצע
  // הדיון לא יהבהב לרגע את מסך ההוראות
  if (loading) return null;

  if (startedAt) {
    return (
      <StageShell
        stage={6}
        // s6-discuss: כל המסך יורד מעט למטה (בקשת המפתחת 2026-11-16, stage-scenes.css)
        className="s6-discuss"
        icon="users"
        background="tide"
        compactHeader
        tightBottom
        clipContent={false}
        width="normal"
        actions={
          <>
            {tipsButton}
            <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onAdvance}>
              סיימנו את הדיון
            </GlassButton>
          </>
        }
      >
        {tipsPopup}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          {/* השאלה נשארת מול העיניים לאורך כל הדיון */}
          <p className="text-ink max-w-3xl text-center text-2xl leading-snug font-extrabold sm:text-3xl">
            {/* שבירה במקום המקף (בקשת המפתחת 2026-11-16): "...לשנות" בשורה
                אחת, "כדי ש..." בשורה הבאה, בלי המקף ביניהן */}
            {(() => {
              const q = intro[0]?.text ?? "";
              const parts = q.split(/\s*[—–-]\s+/);
              if (parts.length < 2) return q;
              return (
                <>
                  {parts[0]}
                  <br />
                  {parts.slice(1).join(" ")}
                </>
              );
            })()}
          </p>
          {/* שעון חול שמתהפך כל דקה (בקשת המפתחת 2026-11-15), במקום טבעת */}
          <Hourglass startedAt={enteredAt ?? new Date().toISOString()} durationMinutes={t.discussion_minutes} label={t.discussion_label} />
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      stage={6}
      icon="users"
      background="tide"
      compactHeader
      tightBottom
      clipContent={false}
      width="normal"
      actions={
        <>
          {/* מופיע רק אחרי הסגירה הראשונה - לפני כן הפופ-אפ עוד בדרך */}
          {fractalReady && tipsButton}
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={start}>
            {t.start_label}
          </GlassButton>
        </>
      }
    >
      {tipsPopup}
      {fractalShowing && (
        <FractalFullscreen
          // בשפת "עיתונאי", כמו בשלב 2 - "כלל הפרקטל" חוזר כמוטיב קבוע (2026-11-15)
          variant="editorial"
          title={t.fractal_title}
          text={t.fractal_text}
          onDone={() => setFractalShowing(false)}
        />
      )}

      {/* בלי מסגרת (בקשת המפתחת 2026-11-15). המילים עולות אחת-אחת מתוך פס
          סמוי; מספר (ה-"10") נכתב ענק ודק באדום-כתום; ושורה מודגשת שבאה
          אחרי שורה שנגמרת ב-":" ("התוצר") מקבלת משיכת מרקר מתחתיה - המרקר
          של שלב 4 חוזר. key: הכניסה מתנגנת שוב כשהטיפים וכלל הפרקטל נסגרים,
          כי קודם היא קרתה מאחוריהם. s6-* ב-editorial.css */}
      <div
        key={fractalReady && !fractalShowing ? "after" : "before"}
        className="s6-lines flex min-h-0 w-full max-w-3xl flex-[0_1_auto] flex-col items-center gap-[0.9vh] px-10 py-[2.4vh] text-center"
      >
        {(() => {
          /* קצב של שורה-שורה (בקשת המפתחת 2026-11-15): כל שורה מתחילה רק
             אחרי שהקודמת נגמרה ונשארה רגע מול העיניים. בתוך השורה המילים
             עולות מהר (WORD_GAP), ובין שורה לשורה יש הפסקה (LINE_PAUSE). */
          const WORD_GAP = 0.06;
          const WORD_DUR = 0.6;
          const LINE_PAUSE = 0.55;
          let clock = 0.4;
          /* שבירה במקום המקף (בקשת המפתחת 2026-11-16, כמו במסך הדיון):
             "...לשנות" בשורה אחת, "כדי ש..." בשורה הבאה, בלי המקף */
          const lines = intro.flatMap((line) =>
            line.text.split(/\s*[—–]\s+|\s+-\s+/).map((part) => ({ ...line, text: part.trim() })),
          );
          return lines.map((line, i) => {
            const marked = Boolean(line.bold && i > 0 && lines[i - 1].text.trim().endsWith(":"));
            const words = line.text.split(/\s+/).filter(Boolean);
            const lineAt = clock;
            const lineEnd = lineAt + (words.length - 1) * WORD_GAP + WORD_DUR;
            clock = lineEnd + LINE_PAUSE;
            return (
              <p
                key={i}
                className={cx("leading-snug", line.bold ? "text-ink font-extrabold" : "text-ink-2")}
                style={{ fontSize: line.bold ? "min(3.4vh, 2rem)" : "min(2.9vh, 1.6rem)" }}
              >
                <span className="sr-only">{line.text}</span>
                <span
                  aria-hidden="true"
                  className={cx("s6-line", marked && "s6-line--mark")}
                  style={{ "--s6-mark-at": `${lineEnd}s` } as React.CSSProperties}
                >
                  {/* הרווח מחוץ ל-s6-w: בתוך inline-block הוא נבלע והמילים נדבקו */}
                  {words.map((word, wi) => (
                    <Fragment key={wi}>
                      <span className="s6-w">
                        <span
                          className={cx("s6-w__in", /^\d+$/.test(word) && "s6-num")}
                          style={{ animationDelay: `${lineAt + wi * WORD_GAP}s` }}
                        >
                          {word}
                        </span>
                      </span>{" "}
                    </Fragment>
                  ))}
                </span>
              </p>
            );
          });
        })()}

        {/* כלל הפרקטל עבר למסך מלא (FractalFullscreen למעלה), שמופיע אחרי
            סגירת הטיפים - ולא במקביל אליהם (דרישת הלקוחה) */}
      </div>
    </StageShell>
  );
}

export default Stage6Discussion;
