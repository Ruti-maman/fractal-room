import AnimatedHourglass from "../AnimatedHourglass";
import type { Stage6Content } from "../../types/stage6Content";
import StageShell from "../StageShell";

/*
 * ============================================================================
 *  שלב 6 - דיון קבוצתי מונחה (שקף 10 במצגת)
 * ============================================================================
 *
 *  מבחינת מנגנון זהו השלב הפשוט בסדנה: משפט השראה (מה-DB) ושעון חול.
 *  הדיון עצמו מתנהל **בעל-פה בחדר** ולא במסך, ולכן המסך צריך לעשות בדיוק
 *  דבר אחד - להחזיק את החדר בקצב, בלי למשוך אליו את העיניים.
 *
 *  ----------------------------------------------------------------------
 *  מה השתנה כאן
 *  ----------------------------------------------------------------------
 *  הגרסה הקודמת עטפה את שעון החול בשלוש שכבות של עיגולים מסתובבים
 *  (22 עיגולים) בחמישה צבעים שונים, ועוד מניפת קרניים ב-conic-gradient.
 *  זה היה יפה בפני עצמו, אבל שני דברים לא עבדו:
 *    1. **הצבעוניות** (ירוק, ליים, כתום, אלמוג) לא הייתה שייכת לשפת
 *       הזכוכית הטורקיז של שאר הסדנה.
 *    2. **התנועה** - שלוש שכבות שמסתובבות כל הזמן מסביב לאובייקט מרכזי
 *       הן בדיוק מה שלא רוצים מאחורי קבוצה שאמורה לדבר זו עם זו.
 *
 *  במקומן: שום דבר. הרקע המשותף של הסדנה (אדוות האור, ראו
 *  styles/background.css) כבר נותן את העומק סביב השעון, ובלי להתחרות בו.
 *  התנועה היחידה על המסך היא החול שיורד - וזה בדיוק המידע שהשלב הזה
 *  צריך להעביר.
 */

interface Props {
  content: Stage6Content;
  onAdvance: () => void;
}

function Stage6Discussion({ content }: Props) {
  return (
    /*
      אותה מעטפת כמו שאר השלבים (תג השלב העגול, התגית מתחתיו) - קודם
      השלב בנה <main> משלו, ו"שלב 6" נכתב בתוך התגית במקום בתג העגול.

      `clipContent={false}`: שעון החול מותאם לגובה בעצמו (ראו הגודל שלו
      למטה), ולכן אזור התוכן לא צריך לגלול - ובלי חיתוך גם ההילה שמאחורי
      השעון לא נגזרת בקו ישר.
    */
    <StageShell
      stage={6}
      kicker="זמן דיון קבוצתי מונחה"
      icon="users"
      background="tide"
      compactHeader
      clipContent={false}
      width="normal"
    >
      {/* המשפט - הוא מה שהקבוצה אמורה לדבר עליו */}
      <blockquote className="glass glass-brick glass-raised relative flex-none rounded-2xl px-8 py-6 text-center">
        <p className="text-ink text-2xl leading-relaxed font-bold sm:text-3xl">
          {content.quote}
        </p>
      </blockquote>

      {/* שעון החול. הגובה שלו הוא הגובה שנשאר אחרי הכותרת, המשפט והשוליים
          (`100dvh - 32rem`), עד 34rem - כך הוא אף פעם לא גולש מתחת למסך. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
        <AnimatedHourglass className="h-[min(34rem,calc(100dvh-32rem))] min-h-40 w-auto" />
      </div>

      <p className="text-ink-3 relative flex-none text-center text-sm">
        הדיון מהווה את הבסיס המקדים לשלב הסימולציות הבא.
      </p>
    </StageShell>
  );
}

export default Stage6Discussion;
