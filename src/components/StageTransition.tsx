import { useEffect, useRef, useState, type ReactNode } from "react";
import { playWhoosh } from "../lib/tapFeedback";

/*
 * ============================================================================
 *  המעבר בין שלבים - "אבני חן"
 * ============================================================================
 *
 *  ----------------------------------------------------------------------
 *  שתי גרסאות קודמות ולמה הן נפלו
 *  ----------------------------------------------------------------------
 *  1. **פריחת אור** - כתם טורקיז שהתפשט ונעלם. אין לו כיוון ואין לו
 *     צורה, והוא נקרא כתקלת תצוגה ולא כמעבר.
 *  2. **תריס להבים** - שבעה פסים אלכסוניים שסגרו את המסך. כיוון היה לו,
 *     אבל הוא היה **אגרסיבי**: פס רחב שחוצה מסך 65" נקרא כחיתוך.
 *
 *  ----------------------------------------------------------------------
 *  מה כאן במקום
 *  ----------------------------------------------------------------------
 *  רשת של **מעוינים** (אבני חן) שצצים לא-לפי-סדר, מכסים את המסך לרגע,
 *  ונעלמים באותו אופן. זה הפתרון שמשחקי אבני-חן משתמשים בו, ויש לו שתי
 *  תכונות שהקודמים לא נתנו:
 *
 *    - **הוא לא חותך.** אין קו אחד שעובר על המסך, אלא הרבה חלקיקים
 *      קטנים - העין קוראת את זה כהתפוררות והתגבשות, לא כסכין.
 *    - **ההשהיה לא ליניארית.** כל מעוין מקבל השהיה מתוך זרע קבוע, כך
 *      שהם צצים מפוזר ולא כגל מסודר. גל מסודר הוא מה שהופך אפקט
 *      לממשק; פיזור הוא מה שהופך אותו למשחק.
 *
 *  באמצע, כשהמסך מכוסה, מוצג מספר השלב הבא.
 *
 *  ----------------------------------------------------------------------
 *  אזהרה למי שיגע בזה
 *  ----------------------------------------------------------------------
 *  אנימציית הכניסה של **עוטף התוכן** היא opacity בלבד, בכוונה גמורה.
 *  `transform` עליו היה הופך אותו לנקודת הייחוס של כל `position: fixed`
 *  שבתוכו - הטיימר, מד ההתקדמות ורצועת ההשראות היו נצמדים לתוכן במקום
 *  למסך. מלכודת שכבר נפלנו בה פעמיים (ראו Stage3Associations ו-ClipPlayer).
 *  כל התנועה שמורה לשכבת המעוינים, שהיא `fixed` ועומדת בפני עצמה.
 */

const COLS = 10;
const ROWS = 6;
const GEM_MS = 620;
const SPREAD_MS = 320;
const TOTAL_MS = GEM_MS + SPREAD_MS + 160;

/** זרע קבוע - אותו פיזור בכל מעבר, בלי "ריצוד" בין רינדורים. */
const GEMS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const rand = (Math.sin((i + 1) * 43.7) + 1) / 2;
  return {
    left: (col / COLS) * 100,
    top: (row / ROWS) * 100,
    delay: Math.round(rand * SPREAD_MS),
    spin: Math.round(rand * 50 - 25),
  };
});

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
        <div key={run.id} className="stage-gems" aria-hidden="true">
          {GEMS.map((gem, i) => (
            <span
              key={i}
              className="stage-gems__gem"
              style={{
                insetInlineStart: `${gem.left}%`,
                top: `${gem.top}%`,
                width: `${100 / COLS}%`,
                height: `${100 / ROWS}%`,
                ["--spin" as string]: `${gem.spin}deg`,
                animationDelay: `${gem.delay}ms`,
                animationDuration: `${GEM_MS}ms`,
              }}
            />
          ))}

          <span className="stage-gems__badge">
            <span className="stage-gems__badge-label">שלב</span>
            <span className="stage-gems__badge-num">{run.stage}</span>
          </span>
        </div>
      )}
    </>
  );
}

export default StageTransition;
