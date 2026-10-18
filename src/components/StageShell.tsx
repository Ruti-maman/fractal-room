/*
 * ============================================================================
 *  מעטפת שלב
 * ============================================================================
 *
 *  לפני השינוי כל שלב בנה לעצמו `<main>` משלו עם גרדיאנט רקע משוכפל, ריווח
 *  אחר, וכותרת בגודל אחר - ולכן המעבר בין שלבים הרגיש כמו מעבר בין אתרים.
 *  כאן מוגדרים פעם אחת: הרקע, הכותרת, רוחב העמודה, הריווח מהקצוות ואזור
 *  הפעולות התחתון.
 *
 *  **הריווח מהקצוות אינו קישוט**: הכרום הגלובלי (טיימר ימין-למטה, מד
 *  התקדמות שמאל-למטה, סרגל עליון) יושב מעל התוכן, והמעטפת שומרת לו מקום
 *  כדי ששום שלב לא ייחתך מתחתיו.
 *
 *  הפעולות יושבות במחצית התחתונה של המסך, כנדרש למסך מגע גדול (סעיף 2
 *  ב-CLAUDE.md) - משתתפת עומדת מול פלזמה של 65", והחלק העליון רחוק מהיד.
 */

import type { CSSProperties, ReactNode } from "react";
import { cx } from "../lib/cx";
import { BackgroundLayers, type BackgroundVariant } from "./ui/AppBackground";
import Icon, { type IconName } from "./ui/Icon";
import { LevelBadge } from "./ui/GameTile";
import { ConclusionInHeader } from "./PracticalConclusionBanner";

interface Props {
  /** מספר השלב - מוצג בתגית העליונה. */
  stage?: number;
  /** כיתוב התגית שמתחת לתג השלב, למשל "שלב משותף". */
  kicker?: string;
  /** מספר השלבים בתוכנית - ממלא את טבעת תג השלב. */
  totalStages?: number;
  icon?: IconName;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** אזור הפעולות התחתון - כפתורים ראשיים של השלב. */
  actions?: ReactNode;
  /** אווירת הרקע של השלב. ראו BackgroundVariant. */
  background?: BackgroundVariant;
  /** רוחב עמודת התוכן. `full` לשלבים שצריכים את כל המסך (קנבס, וידאו). */
  width?: "narrow" | "normal" | "wide" | "full";
  /** מרכוז אנכי. שלב עם מעט תוכן נראה טוב יותר ממורכז. */
  center?: boolean;
  className?: string;
  /** תוכן שיוצא מהזרימה הרגילה - שכבות, פופ-אפים, קנבס. */
  overlay?: ReactNode;
  /**
   * כותרת מוקטנת (עד 4xl במקום 5xl) - לשלבים שהתוכן שלהם צריך כל פיקסל
   * של גובה: הסרטון בשלב 2 והשמש בשלב 3. תג השלב נשאר 88 בכל הדפים -
   * הלקוחה ביקשה שהוא ייראה זהה בכל שלב.
   */
  compactHeader?: boolean;
  /**
   * false = אזור התוכן לא חותך ולא גולל. לשלב שהתוכן שלו כבר מותאם בעצמו
   * לגובה הפנוי (השמש בשלב 3): שם החיתוך רק גזר את הזוהר שמסביב לשמש
   * ויצר "פס" אור ישר בתחתית האזור.
   */
  clipContent?: boolean;
  /**
   * ריווח תחתון מינימלי במסך רחב. לשלב שהתוכן שלו ממורכז וצר מהרווח שבין
   * מד ההתקדמות לטיימר (הסרטון בשלב 2) - הרצועה התחתונה שנשמרת להם
   * סתם גוזלת ממנו גובה.
   */
  tightBottom?: boolean;
  /** style ל-<main> - להזזת המסך כולו בגרירה (ראו SwipeToAdvance). */
  style?: CSSProperties;
}

const WIDTH: Record<NonNullable<Props["width"]>, string> = {
  narrow: "max-w-2xl",
  normal: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

function StageShell({
  stage,
  kicker,
  totalStages = 10,
  icon,
  title,
  subtitle,
  children,
  actions,
  background,
  width = "normal",
  center = true,
  className,
  overlay,
  compactHeader = false,
  clipContent = true,
  tightBottom = false,
  style,
}: Props) {
  const hasHeader = Boolean(stage || kicker || title || subtitle);

  return (
    /*
      שלב = מסך אחד בדיוק. אף פעם לא דף שנגלל.

      זו לא העדפה עיצובית אלא דרישה של המוצר: הסדנה רצה על פלזמת מגע
      קבועה, ואם הדף נגלל אפשר להחליק ולגלות חצי משלב אחר מתחת לשלב
      הנוכחי - בדיוק מה שקרה בשלב 4, שהיה גבוה ב-240 פיקסלים מהמסך.

      לכן: המעטפת ננעלת לגובה החלון (`h-dvh overflow-hidden`,
      ו-dvh ולא vh כדי שסרגל הכתובת הנעלם של אנדרואיד לא יחתוך),
      הכותרת והפעולות מקובעות, ורק **אזור התוכן** גולל בתוך עצמו אם
      התוכן באמת ארוך מדי. כך כפתור הפעולה תמיד נראה, ושום שלב לא
      "דולף" לשלב הבא.
    */
    <main
      className={cx(
        "relative flex h-dvh flex-col items-center overflow-hidden",
        // ריווח שמפנה מקום לסרגל העליון ולכרום התחתון
        // הריווח התחתון קטן במסך רחב בכוונה: הטיימר ומד ההתקדמות יושבים
        // בפינות, ולא מתחת לעמודת התוכן, ולכן אין סיבה לשמור להם רצועה
        // שלמה לרוחב כל המסך. במסך צר הם כן חוסמים את המרכז, ושם הריווח נשאר.
        "px-4 pt-20 pb-40 sm:px-8",
        tightBottom ? "lg:pb-6" : "lg:pb-24",
        className,
      )}
      style={style}
    >
      <BackgroundLayers variant={background} />

      <div
        className={cx(
          "relative flex min-h-0 w-full flex-1 flex-col items-center",
          WIDTH[width],
        )}
      >
        {hasHeader && (
          /*
            סדר הכותרת, מלמעלה למטה (לפי בקשת הלקוחה): תג השלב, התגית
            הקטנה ("הזדהות"), הכותרת, והתיאור.

            הגדלים נשארים קומפקטיים (תג 88, כותרת עד 5xl, ריווח 2): גרסה
            מוקדמת עם תג 96 וכותרת 6xl אכלה כמעט חצי מגובה המסך.
          */
          <header
            className="mb-4 flex flex-none flex-col items-center gap-2 text-center lg:mb-5"
            style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
          >
            {/* תג השלב **מעל** הכותרת ולא לצידה, ובגודל בולט - לפי בקשת
                הלקוחה. */}
            {stage && (
              <LevelBadge
                value={stage}
                progress={totalStages ? stage / totalStages : 1}
                size={88}
              />
            )}

            {/* התגית והמסקנה המעשית באותה שורה, מעל הכותרת */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {kicker && (
                <span className="glass glass-chip text-accent-soft gap-2">
                  {icon && <Icon name={icon} size={15} />}
                  {kicker}
                </span>
              )}
              <ConclusionInHeader />
            </div>

            {title && (
              <h1
                className={cx(
                  "glass-title text-3xl sm:text-4xl",
                  compactHeader ? "lg:text-4xl" : "lg:text-5xl",
                )}
              >
                {title}
              </h1>
            )}

            {subtitle && (
              <p
                // שורת ההסבר מוצגת תמיד - היא אומרת לקבוצה מה עושים בשלב
                className="text-ink-2 max-w-3xl text-base leading-relaxed sm:text-lg"
              >
                {subtitle}
              </p>
            )}
          </header>
        )}

        {/*
          אזור התוכן. `min-h-0` הוא מה שמאפשר ל-flex child לגלול בכלל
          במקום לדחוף את ההורה - בלעדיו הגלילה הפנימית לא קורה.

          **אף מסגרת לא נחתכת:**
          - `center-safe` ולא `justify-center`: מרכוז רגיל של תוכן גבוה
            מהאזור דוחף אותו החוצה **גם מלמעלה**, לשטח שאי אפשר לגלול
            אליו - והשפה העליונה של הכרטיס נעלמה (שלב 2). `safe` ממרכז רק
            כשיש מקום, ואחרת מצמיד למעלה.
          - `p-3` (מול `-m-3` שמחזיר את הרוחב): overflow חותך כל מה שמחוץ
            לתיבה, כולל השפה הצבעונית והצל התלת-ממדי של כרטיס שנוגע בקצה.
        */}
        <div
          className={cx(
            "-m-3 flex w-[calc(100%+1.5rem)] min-h-0 flex-1 flex-col items-center p-3",
            clipContent ? "glass-scroll overflow-y-auto overflow-x-hidden" : "overflow-visible",
            center && "center-safe",
          )}
          style={{ animation: "fade-up var(--ds-dur-slow) 120ms var(--ds-ease) both" }}
        >
          {children}
        </div>

        {actions && (
          <div
            className="mt-4 flex flex-none flex-col items-center gap-4 sm:flex-row sm:justify-center lg:mt-5"
            style={{ animation: "fade-up var(--ds-dur-slow) 240ms var(--ds-ease) both" }}
          >
            {actions}
          </div>
        )}
      </div>

      {overlay}
    </main>
  );
}

export default StageShell;
