import { useEffect } from "react";
import { createPortal } from "react-dom";
import { setStageSubProgress, useStageSubProgress } from "../lib/stageProgress";

/*
 * ============================================================================
 *  פס ההתקדמות של כל הסדנה - פס כתום דק בראש המסך (2026-11-14)
 * ============================================================================
 *
 *  בקשת הלקוחה: "פס טעינה למעלה לאורך כל הפרויקט שיראה התקדמות בצבע כתום".
 *  פס אחד, דק, מקצה לקצה, בכל המסכים - כמו פס התקדמות במשחק. מתמלא מימין
 *  (RTL) לפי השלב שהקבוצה נמצאת בו, וגם בתוך השלב לפי הצעדים הפנימיים
 *  (stageProgress.ts). כל התקדמות "דוחפת" את הפס קדימה בתנועה חלקה.
 *
 *  שכבה משלו מעל כל המסכים המלאים (ההזדהות, הטיפים, כלל הפרקטל), אבל
 *  מתחת למעבר הרשת (z-100) - שם המסך כולו מתחלף, והפס חוזר אחריו.
 *  הקבוצה הזו בלבד - לא ממוצע החדר (בשביל זה יש את מד הקבוצות למטה).
 */
function ProjectProgressBar({ stageNumber, lastStage }: { stageNumber: number; lastStage: number }) {
  const sub = useStageSubProgress();

  // שלב חדש מתחיל מאפס - הדיווח של השלב הקודם לא עובר אליו
  useEffect(() => {
    setStageSubProgress(0);
  }, [stageNumber]);

  const total = Math.max(1, lastStage);
  // בשלב האחרון הפס מלא עד הסוף - "סיום התהליך" (2026-11-15: קודם נעצר ב-90%
  // ונראה כמו משהו שלא הסתיים)
  const done = stageNumber >= total;
  const value = done ? 1 : Math.max(0, Math.min(1, (stageNumber - 1 + sub) / total));

  return createPortal(
    <div
      // is-complete: בסיום - הפס מתעבה, ואור לבן עובר לאורכו (editorial.css)
      className={done ? "pp-bar is-complete" : "pp-bar"}
      role="progressbar"
      aria-label="ההתקדמות בסדנה"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <span className="pp-bar__fill" style={{ transform: `scaleX(${value})` }} />
    </div>,
    document.body,
  );
}

export default ProjectProgressBar;
