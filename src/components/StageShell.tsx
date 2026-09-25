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
import { BackgroundLayers } from "./ui/AppBackground";
import Icon, { type IconName } from "./ui/Icon";

type Botanical = "lavender" | "fern" | "seagrass" | "sprig";

interface Props {
  /** מספר השלב - מוצג בתגית העליונה. */
  stage?: number;
  /** כיתוב התגית שליד מספר השלב, למשל "שלב משותף". */
  kicker?: string;
  icon?: IconName;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** אזור הפעולות התחתון - כפתורים ראשיים של השלב. */
  actions?: ReactNode;
  botanical?: Botanical | false;
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
  icon,
  title,
  subtitle,
  children,
  actions,
  botanical = false,
  width = "normal",
  center = true,
  className,
  overlay,
}: Props) {
  const hasHeader = Boolean(stage || kicker || title || subtitle);

  return (
    <main
      className={cx(
        "relative flex min-h-screen flex-col items-center",
        // ריווח שמפנה מקום לסרגל העליון ולכרום התחתון
        "px-4 pt-20 pb-44 sm:px-8 sm:pt-24 sm:pb-52",
        className,
      )}
    >
      <BackgroundLayers botanical={botanical} />

      {/*
        המרכוז האנכי נעשה ב-`my-auto` על עמודת התוכן ולא ב-`justify-center`
        על המעטפת, וזה ההבדל בין מסך שנראה טוב למסך שנחתך: `justify-center`
        על תוכן גבוה מהחלון דוחף אותו החוצה **משני הקצוות**, כולל מעבר
        לריווח התחתון - וכך כפתור הפעולה של השלב נחתך בתחתית המסך.
        `my-auto` ממרכז כשיש מקום, ומוותר על המרכוז כשאין.
      */}
      <div
        className={cx(
          "relative flex w-full flex-col items-center",
          center && "my-auto",
          WIDTH[width],
        )}
      >
        {hasHeader && (
          <header
            className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-10"
            style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
          >
            {(stage || kicker) && (
              <span className="glass glass-chip text-accent-soft gap-2">
                {icon && <Icon name={icon} size={15} />}
                {stage ? `שלב ${stage}` : null}
                {stage && kicker ? " · " : null}
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

        <div
          className="flex w-full flex-col items-center"
          style={{ animation: "fade-up var(--ds-dur-slow) 120ms var(--ds-ease) both" }}
        >
          {children}
        </div>

        {actions && (
          <div
            className="mt-10 flex flex-col items-center gap-4 sm:mt-12 sm:flex-row sm:justify-center"
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
