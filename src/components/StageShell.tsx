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

import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { BackgroundLayers, type BackgroundVariant } from "./ui/AppBackground";
import Icon, { type IconName } from "./ui/Icon";
import { LevelBadge } from "./ui/GameTile";

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
        "px-4 pt-20 pb-40 sm:px-8 sm:pt-24 sm:pb-44",
        className,
      )}
    >
      <BackgroundLayers variant={background} />

      <div
        className={cx(
          "relative flex min-h-0 w-full flex-1 flex-col items-center",
          WIDTH[width],
        )}
      >
        {hasHeader && (
          <header
            className="mb-6 flex flex-none flex-col items-center gap-3 text-center sm:mb-8"
            style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
          >
            {/*
              תג השלב, בסגנון לוח בחירת שלבים של משחק: מספר גדול בתוך
              עיגול עם טבעת שמתמלאת לפי ההתקדמות בסדנה. החליף צ'יפ טקסט
              קטן - שם "שלב 5" היה מידע, וכאן הוא **מיקום**: רואים במבט
              אחד כמה כבר עברנו וכמה נשאר.
            */}
            {stage && (
              <LevelBadge
                value={stage}
                progress={totalStages ? stage / totalStages : 1}
                size={96}
              />
            )}

            {kicker && (
              <span className="glass glass-chip text-accent-soft gap-2">
                {icon && <Icon name={icon} size={15} />}
                {kicker}
              </span>
            )}

            {title && (
              <h1 className="glass-title text-4xl sm:text-5xl lg:text-6xl">{title}</h1>
            )}

            {subtitle && (
              <p className="text-ink-2 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {subtitle}
              </p>
            )}
          </header>
        )}

        {/* אזור התוכן. `min-h-0` הוא מה שמאפשר ל-flex child לגלול בכלל
            במקום לדחוף את ההורה - בלעדיו הגלילה הפנימית לא קורה. */}
        <div
          className={cx(
            "glass-scroll flex w-full min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden",
            center && "justify-center",
          )}
          style={{ animation: "fade-up var(--ds-dur-slow) 120ms var(--ds-ease) both" }}
        >
          {children}
        </div>

        {actions && (
          <div
            className="mt-6 flex flex-none flex-col items-center gap-4 sm:mt-8 sm:flex-row sm:justify-center"
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
