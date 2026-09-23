import { useState } from "react";
import type { Stage5Content, SolutionOption } from "../../types/stage5Content";

interface Props {
  content: Stage5Content;
  onAdvance: () => void;
}

/** וי מצויר (SVG) במקום אימוג'י - נראה זהה ומדויק בכל דפדפן, גם ישן (ראו סעיף 2 ב-CLAUDE.md). */
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M4 12.5 9.5 18 20 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** X מצויר (SVG) - אותה סיבה: לא להסתמך על עיבוד אימוג'י של הדפדפן במסך. */
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

/**
 * שלב 5 - גיבוש פתרונות (שקף 9 במצגת). אותו מנגנון בדיוק כמו קודם (4 כפתורי
 * אפשרות, לחיצה פותחת פופ-אפ: שגויה מסבירה למה ומאפשרת לנסות שוב, נכונה
 * מעבירה הלאה) - כאן רק עיצוב הרבה יותר מוקפד/עדכני מסביב לאותו רעיון.
 *
 * זהו **קו העיצוב הבסיסי של הסדנה**: כרטיס עם פינות רכות (rounded-[2.5rem]),
 * מסגרת דקה, גרדיאנט כחול-מעושן והברקה עדינה בקצה העליון. שלבים אחרים
 * (למשל שעון החול בשלב 6) בנויים באותה שפה בדיוק, כדי שהסדנה תרגיש כמוצר
 * אחד ולא כאוסף מסכים.
 *
 * חשוב: ארבעת הכרטיסים נראים **זהים** זה לזה (אותו עיצוב, אין רמז ויזואלי
 * לאיזו נכונה) - צביעת האפשרות הנכונה מראש הייתה הורסת את התרגיל הפדגוגי.
 *
 * אנימציות ה-CSS (pop-in/bounce-in/shake-x/success-glow) מוגדרות פעם אחת
 * ב-src/index.css כספרייה משותפת, לא כאן - כדי שאפשר יהיה להשתמש באותה
 * "שפת עיצוב" גם בשלבים עתידיים בלי לשכפל keyframes.
 */
function Stage5Solutions({ content, onAdvance }: Props) {
  const [chosen, setChosen] = useState<SolutionOption | null>(null);

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-14 overflow-hidden p-8 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 15%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 45%, var(--color-smoke-blue-darker) 100%)",
      }}
    >
      {/* כתמי אור רכים ברקע - קישוט אווירה בלבד, לא נוגעים באינטראקציה. */}
      <div className="pointer-events-none absolute top-[-10%] right-[8%] h-80 w-80 rounded-full bg-wood-light/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-15%] left-[5%] h-96 w-96 rounded-full bg-smoke-blue/30 blur-[120px]" />

      <div className="relative flex flex-col items-center gap-3">
        <span className="rounded-full border border-white/15 bg-white/5 px-5 py-1.5 text-xs font-bold tracking-widest text-white/50 uppercase">
          שלב 5
        </span>
        <h1 className="bg-linear-to-l from-white to-white/70 bg-clip-text text-5xl font-black tracking-tight text-transparent">
          גיבוש פתרונות
        </h1>
        <p className="text-lg text-white/60">איזו דרך פתרון הקבוצה בוחרת?</p>
      </div>

      <div className="relative grid grid-cols-2 gap-8">
        {content.options.map((opt, i) => (
          <button
            key={i}
            className="group relative flex h-56 w-[26rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-[2.5rem] border border-white/15 bg-linear-to-br from-smoke-blue to-smoke-blue-dark px-12 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-2 hover:border-white/30 hover:shadow-[0_32px_70px_-15px_rgba(0,0,0,0.7)] active:translate-y-0 active:scale-95 active:duration-100"
            onClick={() => setChosen(opt)}
          >
            {/* אותה הברקה עדינה למעלה שיש גם בפופ-אפ - שפת עיצוב אחידה. */}
            <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-white/5 blur-3xl" />
            {/* זוהר שמתחזק בהובר - קישוט בלבד. */}
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-wood-light/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

            <p className="relative text-2xl leading-snug font-bold">{opt.label}</p>
            <div className="relative flex items-center gap-2 text-sm font-bold text-white/40 transition-colors duration-300 group-hover:text-white/80">
              <span>לבחירה</span>
              <span aria-hidden="true">←</span>
            </div>
          </button>
        ))}
      </div>

      {chosen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 backdrop-blur-sm"
          style={{ animation: "backdrop-in 0.25s ease-out" }}
        >
          <div
            className={`relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border p-10 text-center shadow-2xl ${
              chosen.correct
                ? "border-green-400/30 bg-linear-to-br from-green-900/95 via-smoke-blue-darker to-smoke-blue-darker"
                : "border-accent-red/40 bg-linear-to-br from-red-950/95 via-smoke-blue-darker to-smoke-blue-darker"
            }`}
            style={{ animation: "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-[50%] bg-white/5 blur-3xl" />

            <div
              className={`relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full ${
                chosen.correct ? "bg-green-500/20 text-green-300" : "bg-accent-red/20 text-red-300"
              }`}
              style={{
                animation: chosen.correct
                  ? "success-glow 1.8s ease-in-out infinite"
                  : "shake-x 0.5s ease-in-out",
              }}
            >
              <div style={{ animation: "bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both" }}>
                {chosen.correct ? <CheckIcon /> : <XIcon />}
              </div>
            </div>

            <p className="relative mb-8 text-2xl leading-relaxed font-bold">{chosen.explanation}</p>

            {chosen.correct ? (
              <button
                className="from-smoke-blue to-wood-dark relative flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-l px-8 py-5 text-xl font-bold shadow-lg shadow-black/30 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
                onClick={onAdvance}
              >
                המשך לפתרון המערכתי
                <span aria-hidden="true">←</span>
              </button>
            ) : (
              <button
                className="relative w-full rounded-full bg-white/10 px-8 py-5 text-xl font-bold transition-transform duration-150 hover:bg-white/15 active:scale-95"
                onClick={() => setChosen(null)}
              >
                ננסה שוב
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default Stage5Solutions;
