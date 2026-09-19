import { useState } from "react";
import type { Stage5Content, SolutionOption } from "../../types/stage5Content";

interface Props {
  content: Stage5Content;
  onAdvance: () => void;
}

/**
 * שלב 5 - גיבוש פתרונות (שקף 9 במצגת). 4 כפתורי אפשרות, לחיצה על אחת פותחת
 * פופ-אפ: אפשרות שגויה מסבירה למה ומאפשרת לנסות שוב; האפשרות הנכונה
 * ("שינוי פדגוגי עמוק ומובנה") מעבירה לשלב הבא.
 */
function Stage5Solutions({ content, onAdvance }: Props) {
  const [chosen, setChosen] = useState<SolutionOption | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-2xl font-bold">גיבוש פתרונות</h1>
      <p className="text-white/70">איזו דרך פתרון הקבוצה בוחרת?</p>

      <div className="grid grid-cols-2 gap-4">
        {content.options.map((opt, i) => (
          <button
            key={i}
            className="bg-smoke-blue active:bg-smoke-blue-dark w-56 rounded-xl px-6 py-6 text-lg font-bold transition-transform duration-100 active:scale-90"
            onClick={() => setChosen(opt)}
          >
            אפשרות {"אבגד"[i]}: {opt.label}
          </button>
        ))}
      </div>

      {chosen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-8">
          <div className="max-w-md rounded-2xl bg-wood/90 p-8 text-center">
            <div className="mb-4 text-6xl">{chosen.correct ? "✅" : "❌"}</div>
            <p className="mb-6 text-xl font-bold">{chosen.explanation}</p>
            {chosen.correct ? (
              <button
                className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-8 py-4 text-lg font-bold active:scale-90"
                onClick={onAdvance}
              >
                המשך לפתרון המערכתי
              </button>
            ) : (
              <button
                className="rounded-xl bg-white/20 px-8 py-4 text-lg font-bold active:scale-90"
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
