import { useState } from "react";
import type { Group } from "../../types/group";
import { usePrinciples } from "../../hooks/usePrinciples";

interface Props {
  workshopId: string;
  myGroup: Group;
}

/**
 * שלב 10 - ניסוח 3 עקרונות מנחים, משותף לכל הקבוצות (שקף 15 במצגת).
 * זה השלב האחרון - אין "הבא" בסוף, רק מסך סיום. הניסוח בעזרת AI מתוכנן
 * להמשך (דרך Supabase Edge Function, ראו סעיף 2 ב-CLAUDE.md) - כרגע הקלדה ישירה.
 */
function Stage10Principles({ workshopId, myGroup }: Props) {
  const { principles, loading, updatePrinciple } = usePrinciples(workshopId, myGroup.id);
  const [drafts, setDrafts] = useState<string[]>(["", "", ""]);

  const allFilled = principles.every((p) => p.trim().length > 0);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
      </main>
    );
  }

  if (allFilled) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-7xl">🎉</div>
        <h1 className="text-3xl font-bold">הסדנה הסתיימה!</h1>
        <p className="max-w-lg text-white/70">כל הנתונים נשמרו במערכת.</p>
        <div className="flex flex-col gap-3">
          {principles.map((p, i) => (
            <div key={i} className="rounded-xl bg-white/10 px-6 py-3">
              {i + 1}. {p}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">ניסוח עקרונות מנחים</h1>
      <p className="max-w-lg text-center text-white/70">
        מתוך כל הידע שנצבר בסדנה, נסחו יחד 3 עקרונות חדשניים מנחים.
      </p>

      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-6 text-xl font-bold">{i + 1}.</span>
            <input
              className="w-96 rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder={`עיקרון מנחה ${i + 1}`}
              value={principles[i] || drafts[i]}
              disabled={!!principles[i]}
              onChange={(e) => {
                const next = drafts.slice();
                next[i] = e.target.value;
                setDrafts(next);
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) updatePrinciple(i, e.target.value.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

export default Stage10Principles;
