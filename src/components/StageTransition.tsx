import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * ============================================================================
 *  המעבר בין שלבים
 * ============================================================================
 *
 *  עד עכשיו שלב פשוט **הוחלף** בשלב הבא בפריים אחד. על מסך של 65" זה
 *  נקרא כמו הבזק, ובחדר שבו שלוש קבוצות מתקדמות בקצב שונה זה גם מבלבל:
 *  לא ברור אם משהו התקדם או שמשהו נשבר.
 *
 *  כאן המעבר מרוכך בשתי שכבות:
 *    1. **פריחת אור** שעוברת על כל המסך (`.stage-veil`) - היא זו
 *       שמסמנת "עברנו".
 *    2. **המסך החדש נמוג פנימה** במקום להופיע מוכן.
 *
 *  ----------------------------------------------------------------------
 *  אזהרה למי שיגע בזה
 *  ----------------------------------------------------------------------
 *  אנימציית הכניסה של העוטף היא **opacity בלבד**, בכוונה גמורה. הוספת
 *  `transform` (או `filter`, או `backdrop-filter`) לעוטף הייתה הופכת
 *  אותו לנקודת הייחוס של כל `position: fixed` שבתוכו - כלומר הטיימר,
 *  מד ההתקדמות ורצועת ההשראות היו נצמדים לתוכן במקום למסך. זו מלכודת
 *  שכבר נפלנו בה פעמיים בפרויקט הזה (ראו Stage3Associations ו-ClipPlayer).
 *
 *  כל התנועה שמורה ל-veil, שהוא `fixed` ועומד בפני עצמו.
 */

interface Props {
  /** מזהה השלב. שינוי שלו הוא מה שמפעיל את המעבר. */
  stageKey: number;
  children: ReactNode;
}

function StageTransition({ stageKey, children }: Props) {
  const previous = useRef(stageKey);
  const [veil, setVeil] = useState(0);

  useEffect(() => {
    if (previous.current === stageKey) return;
    previous.current = stageKey;
    setVeil((n) => n + 1);
  }, [stageKey]);

  return (
    <>
      <div
        key={stageKey}
        style={{ animation: "page-fade 480ms var(--ds-ease) both" }}
      >
        {children}
      </div>

      {/* veil > 0 מונע פריחה בטעינה הראשונה - רק במעבר אמיתי בין שלבים */}
      {veil > 0 && <div key={veil} className="stage-veil" aria-hidden="true" />}
    </>
  );
}

export default StageTransition;
