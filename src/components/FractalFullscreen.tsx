import { createPortal } from "react-dom";
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
 * portal ל-body: שכבה fixed בתוך המעבר המונפש של השלב נמדדת ביחס להורה
 * ולא לחלון (באג 6 ב-CLAUDE.md).
 */
function FractalFullscreen({ title, text, onDone }: { title: string; text: string; onDone: () => void }) {
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
      <h2 className="glass-title relative flex-none text-5xl lg:text-6xl">{title}</h2>
      <FractalSentence
        text={text}
        letters="פרקטל"
        solid={false}
        grain={6}
        once
        // נבנה, מתפרק ונבנה שוב - שלוש פעמים (בקשת הלקוחה 2026-11-08)
        repeats={3}
        // נצנוץ קסום בתחילת כל בנייה
        onBuildStart={playSparkle}
        onDone={onDone}
        className="relative min-h-0 w-full flex-1"
      />
    </div>,
    document.body,
  );
}

export default FractalFullscreen;
