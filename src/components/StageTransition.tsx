import { useEffect, useRef, useState, type ReactNode } from "react";
import { playWhoosh } from "../lib/tapFeedback";

/*
 * ============================================================================
 *  המעבר בין שלבים - "תריס הזכוכית"
 * ============================================================================
 *
 *  ----------------------------------------------------------------------
 *  מה היה כאן קודם ולמה זה לא עבד
 *  ----------------------------------------------------------------------
 *  הגרסה הקודמת הייתה "פריחת אור": כתם טורקיז רך שהתפשט על המסך ונעלם.
 *  היא נראתה כמו תקלת תצוגה יותר מאשר כמו מעבר - אין לה כיוון, אין לה
 *  צורה, ואי אפשר להבין ממנה ששלב נגמר ושלב חדש התחיל.
 *
 *  ----------------------------------------------------------------------
 *  איך משחקים עושים את זה
 *  ----------------------------------------------------------------------
 *  מעבר שלב במשחק הוא תמיד שלושה פעימות, ובסדר הזה:
 *
 *    1. **סגירה** - משהו מכסה את המסך בתנועה בעלת כיוון ברור.
 *    2. **הכרזה** - ברגע שהמסך מכוסה, מוצג מה הלאה.
 *    3. **פתיחה** - הכיסוי נפתח וחושף את המסך החדש.
 *
 *  כאן הכיסוי הוא **שבעה להבי זכוכית** אלכסוניים שנכנסים לסירוגין
 *  מלמעלה ומלמטה בהשהיה מדורגת, נסגרים לרגע, ואז ממשיכים באותו כיוון
 *  והחוצה. באמצע ההכרזה: מספר השלב הבא.
 *
 *  הלהבים אלכסוניים (`skewX`) ולא ישרים, וזו לא קפריזה: קו אנכי חד
 *  קורא כמסך שנחתך, וקו אלכסוני קורא כתנועה. זה ההבדל בין "נתקע" לבין
 *  "עברנו".
 *
 *  ----------------------------------------------------------------------
 *  אזהרה למי שיגע בזה
 *  ----------------------------------------------------------------------
 *  אנימציית הכניסה של **עוטף התוכן** היא opacity בלבד, בכוונה גמורה.
 *  `transform` עליו היה הופך אותו לנקודת הייחוס של כל `position: fixed`
 *  שבתוכו - הטיימר, מד ההתקדמות ורצועת ההשראות היו נצמדים לתוכן במקום
 *  למסך. זו מלכודת שכבר נפלנו בה פעמיים (ראו Stage3Associations
 *  ו-ClipPlayer). כל התנועה שמורה ללהבים, שהם `fixed` ועומדים בפני עצמם.
 */

const BLADES = 7;
/** כמה זמן לוקח לכל להב לחצות. ההשהיה המדורגת מוסיפה על זה. */
const BLADE_MS = 520;
const STAGGER_MS = 55;
const TOTAL_MS = BLADE_MS + BLADES * STAGGER_MS;

interface Props {
  /** מספר השלב. שינוי שלו הוא מה שמפעיל את המעבר. */
  stageKey: number;
  children: ReactNode;
}

function StageTransition({ stageKey, children }: Props) {
  const previous = useRef(stageKey);
  const [run, setRun] = useState<{ id: number; stage: number } | null>(null);

  useEffect(() => {
    if (previous.current === stageKey) return;
    previous.current = stageKey;
    setRun({ id: Date.now(), stage: stageKey });
    playWhoosh();
    const t = window.setTimeout(() => setRun(null), TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [stageKey]);

  return (
    <>
      <div key={stageKey} style={{ animation: "page-fade 420ms var(--ds-ease) both" }}>
        {children}
      </div>

      {run && (
        <div key={run.id} className="stage-wipe" aria-hidden="true">
          {Array.from({ length: BLADES }, (_, i) => (
            <span
              key={i}
              className="stage-wipe__blade"
              style={{
                // להבים זוגיים נכנסים מלמעלה ואי-זוגיים מלמטה, כך
                // שהסגירה נראית כמו תריס ולא כמו גל אחד
                ["--from" as string]: i % 2 === 0 ? "-130%" : "130%",
                ["--to" as string]: i % 2 === 0 ? "130%" : "-130%",
                insetInlineStart: `${(i * 100) / BLADES}%`,
                width: `${100 / BLADES + 2}%`,
                animationDelay: `${i * STAGGER_MS}ms`,
                animationDuration: `${BLADE_MS}ms`,
              }}
            />
          ))}

          {/* ההכרזה - מופיעה בדיוק כשהמסך מכוסה */}
          <span className="stage-wipe__badge">
            <span className="stage-wipe__badge-label">שלב</span>
            <span className="stage-wipe__badge-num">{run.stage}</span>
          </span>
        </div>
      )}
    </>
  );
}

export default StageTransition;
