import { useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePortalHost } from "../lib/portalHost";
import { playSparkle } from "../lib/tapFeedback";
import FractalSentence from "./FractalSentence";
import { BackgroundLayers } from "./ui/AppBackground";

/**
 * "כלל הפרקטל" על כל המסך (בקשת הלקוחה, 2026-11-08 - שלב 2 ושלב 6).
 *
 * המשפט נבנה פעם אחת ממערבולת של אותיות פ-ר-ק-ט-ל קטנות, **בלי להפוך
 * לכתב מלא** - הוא נשאר עשוי אותיות. אחרי ההחזקה נקרא onDone, וההורה
 * מחליט מה הלאה.
 *
 * שתי גרסאות:
 *  - "editorial" (שלב 2, 2026-11-12) - בשפת "עיתונאי", ראו EditorialFractal.
 *  - "glass" (ברירת מחדל, שלב 6 - עוד לא עוצב מחדש) - הרקע הקודם.
 *
 * portal ל-body: שכבה fixed בתוך המעבר המונפש של השלב נמדדת ביחס להורה
 * ולא לחלון (באג 6 ב-CLAUDE.md).
 */
function FractalFullscreen({
  title,
  text,
  onDone,
  variant = "glass",
}: {
  title: string;
  text: string;
  onDone: () => void;
  variant?: "glass" | "editorial";
}) {
  const host = usePortalHost();
  if (variant === "editorial") return <EditorialFractal title={title} text={text} onDone={onDone} />;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center px-8 pt-16 pb-10"
      style={{
        // אטום: השכבות הדקורטיביות שקופות, ובלי רקע מלא המסך הקודם נראה מבעד
        background: "linear-gradient(160deg, var(--ds-bg-from), var(--ds-bg-via), var(--ds-bg-to))",
        // page-fade ולא fade-up: transform על השכבה היה הופך אותה לנקודת
        // הייחוס של כל fixed שבתוכה
        animation: "page-fade var(--ds-dur-slow) var(--ds-ease) both",
      }}
    >
      <BackgroundLayers variant="night" />
      {/* הקנבס על כל המסך, מקצה לקצה, מאחורי הכותרת: שדה האותיות בסרטון
          של הלקוחה ממלא את כל הפריים, בלי שוליים ריקים (2026-11-11) */}
      <FractalSentence
        text={text}
        letters="פרקטל"
        solid={false}
        // ברור יותר (2026-11-25): כתב כמעט מלא מתחת, ואותיות צפופות יותר
        underlay={0.8}
        grain={5}
        once
        // נבנה פעם אחת בלבד (בקשת הלקוחה 2026-11-11: "שיהיה פעם אחת").
        // קודם: שלוש פעמים (2026-11-08).
        repeats={1}
        // נצנוץ קסום בתחילת הבנייה
        onBuildStart={playSparkle}
        onDone={onDone}
        className="absolute inset-0"
      />
      <h2 className="glass-title relative z-10 flex-none text-5xl lg:text-6xl">{title}</h2>
    </div>,
    host,
  );
}

/*
 * ============================================================================
 *  "כלל הפרקטל" בשפת "עיתונאי" (2026-11-12)
 * ============================================================================
 *
 *  הרעיון: **רשת הריבועים של האתר הופכת לפרקטל** - "חלק קטן, אבל כבר רואים
 *  בו את השלם". שלוש פעימות, כ-9 שניות, ואז onDone:
 *
 *   1. ריבועי הרשת מתמלאים בכחול באלכסון ↙, מעל מסך ההזדהות - בדיוק כמו
 *      מעבר הרשת שהוביל לכאן (אותן מחלקות .gc-cell). עמוד כחול מלא, עם
 *      קווי רשת לבנים (בעמוד כחול מלא כן שמים קווים).
 *   2. ריבוע אדום קטן - הריבוע של הלוגו - נדלק באמצע. ממנו הרשת מתחלקת
 *      שוב ושוב: כל ריבוע ל-4, ואז שוב ל-4, וגל החלוקה מתפשט ממנו החוצה
 *      עד קצות המסך. הרשת עצמה נהיית פרקטל.
 *   3. הריבוע האדום נבלע, ומתוכו המשפט נבנה מאותיות פ-ר-ק-ט-ל לבנות
 *      קטנות שעפות פנימה (FractalSentence) - מהמרכז החוצה.
 *
 *  הכותרת לבנה ועבה בצד ימין, עם ריבוע אדום - כמו "מי אתן?" במסך הקודם.
 *  CSS: .fx-* ב-styles/editorial.css.
 */
function EditorialFractal({ title, text, onDone }: { title: string; text: string; onDone: () => void }) {
  const host = usePortalHost();
  // הגאומטריה נמדדת פעם אחת: שורות הרשת, והריבוע הקטן ביותר שבאמצע
  const geo = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const col = w / 8;
    const rows = Math.ceil(h / col);
    const seed = col / 8; // שלוש חלוקות: 12.5vw -> 6.25 -> 3.125 -> 1.5625
    // הזרע יושב על משבצת אמיתית של הרשת הכי קטנה, צמוד למרכז
    const left = w / 2 - seed;
    const top = Math.round(h / 2 / seed) * seed - seed;
    return { rows, seed, left, top, cx: left + seed / 2, cy: top + seed / 2 };
  }, []);

  const cells = [];
  for (let row = 0; row < geo.rows; row++) {
    for (let col = 0; col < 8; col++) {
      cells.push(
        <span
          key={`${row}-${col}`}
          className="gc-cell"
          style={
            {
              left: `${(7 - col) * 12.5}vw`,
              top: `${row * 12.5}vw`,
              "--gc-i": col + row,
            } as CSSProperties
          }
        />,
      );
    }
  }

  const center = { "--fx-cx": `${geo.cx}px`, "--fx-cy": `${geo.cy}px` } as CSSProperties;

  return createPortal(
    <div className="fx-page" style={{ "--gc-step": "42ms", "--gc-cell": "460ms" } as CSSProperties}>
      <div aria-hidden="true">{cells}</div>

      {/* גלי החלוקה: כל שכבה היא רשת בחצי הגודל של הקודמת, שנחשפת במעגל
          שמתרחב מהזרע האדום */}
      <div aria-hidden="true" className="fx-sub fx-sub--1" style={center} />
      <div aria-hidden="true" className="fx-sub fx-sub--2" style={center} />
      <div aria-hidden="true" className="fx-sub fx-sub--3" style={center} />

      {/* הזרע - הריבוע האדום של הלוגו */}
      <span
        aria-hidden="true"
        className="fx-seed"
        style={{ left: geo.left, top: geo.top, width: geo.seed, height: geo.seed }}
      />

      <FractalSentence
        text={text}
        letters="פרקטל"
        solid={false}
        // ברור יותר (2026-11-25): כתב כמעט מלא מתחת, ואותיות צפופות יותר
        underlay={0.8}
        grain={5}
        once
        repeats={1}
        color="#ffffff"
        onBuildStart={playSparkle}
        onDone={onDone}
        className="absolute inset-0"
      />

      <h2 className="fx-title">
        <span className="fx-title__square" aria-hidden="true" />
        {title}
      </h2>
    </div>,
    host,
  );
}

export default FractalFullscreen;
