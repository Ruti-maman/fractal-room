import { useState } from "react";
import { createPortal } from "react-dom";
import type { Stage6Content, Stage6Line } from "../../types/stage6Content";
import type { Group } from "../../types/group";
import { useDiscussionStart } from "../../hooks/useDiscussionStart";
import StageShell from "../StageShell";
import Timer from "../Timer";
import TipPopups, { type Tip, type TipSlot } from "../TipPopups";
import FractalSentence from "../FractalSentence";
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
 *     עיצוב כמו בשלב 2 (FractalSentence), וחמשת הטיפים לדיון טוב בחלוניות
 *     שקופצות משני הצדדים (TipPopups, כמו בשלב 2). הכפתור "בואו נדבר על זה"
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
  fractal_title: "כלל הפרקטל",
  fractal_text: "תשובה טובה לא סוגרת את הדיון. היא פותחת עוד שכבה.",
  discussion_minutes: 10,
  discussion_label: "זמן לעריכת הדיון",
};

/*
  מיקומי החלוניות בשלב הזה: בצד שמאל יושב סולם ההשראות (למעלה) ומד
  ההתקדמות (למטה), ולכן שתי החלוניות השמאליות נכנסות ביניהם. בצד ימין -
  מתחת לתג הקבוצה ומעל הטיימר.
*/
const STAGE6_TIP_SLOTS: TipSlot[] = [
  { side: "right", top: "26%" },
  { side: "left", top: "42%" },
  { side: "right", top: "42%" },
  { side: "left", top: "58%" },
  { side: "right", top: "58%" },
];

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage6Content;
  onAdvance: () => void;
}

function Stage6Discussion({ workshopId, myGroup, content, onAdvance }: Props) {
  const { startedAt, loading, start } = useDiscussionStart(workshopId, myGroup.id);
  const [hiddenTips, setHiddenTips] = useState<number[]>([]);

  const t = { ...DEFAULTS, ...content };
  const intro = content.intro_lines?.length ? content.intro_lines : DEFAULT_INTRO;
  const tips = content.tips?.length ? content.tips : DEFAULT_TIPS;

  // עד שידוע אם הדיון כבר התחיל - לא מציגות אף מסך, כדי שרענון באמצע
  // הדיון לא יהבהב לרגע את מסך ההוראות
  if (loading) return null;

  if (startedAt) {
    return (
      <StageShell
        stage={6}
        kicker="זמן דיון קבוצתי מונחה"
        icon="users"
        background="tide"
        compactHeader
        tightBottom
        clipContent={false}
        width="normal"
        actions={
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onAdvance}>
            סיימנו את הדיון
          </GlassButton>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          {/* השאלה נשארת מול העיניים לאורך כל הדיון */}
          <p className="text-ink max-w-3xl text-center text-2xl leading-snug font-extrabold sm:text-3xl">
            {intro[0]?.text}
          </p>
          <Timer
            placement="center"
            startedAt={startedAt}
            durationMinutes={t.discussion_minutes}
            label={t.discussion_label}
          />
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      stage={6}
      kicker="זמן דיון קבוצתי מונחה"
      icon="users"
      background="tide"
      compactHeader
      tightBottom
      clipContent={false}
      width="normal"
      actions={
        <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={start}>
          {t.start_label}
        </GlassButton>
      }
    >
      {/* החלוניות ב-portal: StageShell מונפש ב-transform, ו-fixed בתוך
          הורה עם transform נמדד ביחס להורה ולא לחלון (באג 6 ב-CLAUDE.md) */}
      {createPortal(
        <TipPopups
          title={t.tips_title}
          tips={tips}
          hidden={hiddenTips}
          onClose={(i) => setHiddenTips((prev) => [...prev, i])}
          slots={STAGE6_TIP_SLOTS}
          titleTop="13%"
        />,
        document.body,
      )}

      <div className="glass glass-brick glass-raised flex min-h-0 w-full max-w-3xl flex-[0_1_auto] flex-col items-center gap-[0.6vh] rounded-2xl px-10 py-[2.4vh] text-center">
        {intro.map((line, i) => (
          <p
            key={i}
            className={cx("leading-snug", line.bold ? "text-ink font-extrabold" : "text-ink-2")}
            style={{
              fontSize: line.bold ? "min(3.4vh, 2rem)" : "min(2.9vh, 1.6rem)",
              animation: `fade-up 0.6s ${0.15 + i * 0.12}s var(--ds-ease) both`,
            }}
          >
            {line.text}
          </p>
        ))}

        {/* כלל הפרקטל - באותו עיצוב כמו בסיכום שלב 2 */}
        <div className="mt-[1vh] flex min-h-0 w-full flex-[0_1_auto] flex-col items-center gap-1">
          <span className="text-accent-soft flex flex-none items-center gap-2 text-lg font-extrabold">
            {t.fractal_title}
          </span>
          <FractalSentence text={t.fractal_text} className="h-[min(8rem,13vh)] min-h-10 w-full flex-[0_1_auto]" />
        </div>
      </div>
    </StageShell>
  );
}

export default Stage6Discussion;
