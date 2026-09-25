import AnimatedHourglass from "../AnimatedHourglass";
import type { Stage6Content } from "../../types/stage6Content";
import { BackgroundLayers } from "../ui/AppBackground";
import Icon from "../ui/Icon";

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
 *  במקומן: טבעות זכוכית דקות וסטטיות סביב השעון, שנותנות את אותה תחושת
 *  עומק בלי תנועה, והתנועה היחידה על המסך היא החול שיורד - שזה בדיוק
 *  המידע שהשלב הזה צריך להעביר.
 */

/**
 * טבעות הזכוכית סביב השעון. רדיוס באחוזים מגודל השכבה, ועובי שיורד
 * כלפי חוץ - כך הן נקראות כהד מתרחב של השעון ולא כמעגלים אקראיים.
 */
const RINGS = [
  { size: 30, opacity: 0.3, width: 1.5 },
  { size: 42, opacity: 0.22, width: 1.25 },
  { size: 56, opacity: 0.15, width: 1 },
  { size: 72, opacity: 0.09, width: 1 },
];

interface Props {
  content: Stage6Content;
  onAdvance: () => void;
}

function Stage6Discussion({ content }: Props) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-4 pt-24 pb-44 text-center sm:px-8">
      <BackgroundLayers />

      {/* טבעות הד סביב מרכז הדף - סטטיות בכוונה, ראו ההסבר למעלה */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {RINGS.map((ring) => (
          <div
            key={ring.size}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: `${ring.size}vmin`,
              height: `${ring.size}vmin`,
              border: `${ring.width}px solid var(--ds-accent)`,
              opacity: ring.opacity,
            }}
          />
        ))}
      </div>

      {/* המשפט למעלה - הוא מה שהקבוצה אמורה לדבר עליו */}
      <div
        className="relative flex w-full max-w-3xl flex-col items-center gap-5"
        style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
      >
        <span className="glass glass-chip text-accent-soft gap-2">
          <Icon name="users" size={15} />
          שלב 6 · זמן דיון קבוצתי מונחה
        </span>

        <blockquote className="glass glass-brick rounded-2xl px-8 py-7">
          <p className="text-ink text-2xl leading-relaxed font-bold sm:text-3xl">
            {content.quote}
          </p>
        </blockquote>
      </div>

      {/* שעון החול - הלב של השקף */}
      <div
        className="relative flex flex-1 items-center justify-center py-6"
        style={{ animation: "fade-up var(--ds-dur-slow) 150ms var(--ds-ease) both" }}
      >
        <AnimatedHourglass />
      </div>

      <p
        className="text-ink-3 relative text-sm"
        style={{ animation: "fade-up var(--ds-dur-slow) 300ms var(--ds-ease) both" }}
      >
        הדיון מהווה את הבסיס המקדים לשלב הסימולציות הבא.
      </p>
    </main>
  );
}

export default Stage6Discussion;
