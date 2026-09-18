import { useState } from "react";
import type { Group } from "../../types/group";
import type { Stage3Content } from "../../types/stage3Content";
import { useInspirations } from "../../hooks/useInspirations";

const MAX_SELECTED = 4;

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage3Content;
  onAdvance: () => void;
}

function Stage3Associations({ workshopId, myGroup, content, onAdvance }: Props) {
  const { items, loading, save } = useInspirations(workshopId, myGroup.id);
  const [draft, setDraft] = useState("");
  const [showingTransition, setShowingTransition] = useState(false);

  const selectedCount = items.filter((i) => i.selected).length;

  function addInspiration() {
    const text = draft.trim();
    if (!text) return;
    save([...items, { text, selected: false }]);
    setDraft("");
  }

  function toggleSelected(index: number) {
    const item = items[index];
    if (!item.selected && selectedCount >= MAX_SELECTED) return;
    save(items.map((it, i) => (i === index ? { ...it, selected: !it.selected } : it)));
  }

  function handleFinish() {
    setShowingTransition(true);
    setTimeout(onAdvance, 2000);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
      </main>
    );
  }

  if (showingTransition) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-3xl font-bold">{content.transition_text}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">שמש אסוציאציות</h1>

      {/* "שמש" - עיגול מרכזי עם הדילמה, וסביבו השראות כחיצים. עיצוב סופי יגיע עם המיתוג. */}
      <div className="flex h-40 w-40 items-center justify-center rounded-full bg-wood/60 p-4 text-center text-sm font-bold">
        {content.dilemma_text}
      </div>

      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-3">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => toggleSelected(i)}
            className={`rounded-full px-4 py-2 text-sm transition-transform active:scale-90 ${
              item.selected ? "bg-accent-red font-bold" : "bg-white/10"
            }`}
          >
            {item.text}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="w-64 rounded-xl bg-white/10 px-4 py-3 text-center outline-none"
          placeholder="כתבי כאן השראה שקשורה לדילמה"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addInspiration()}
        />
        <button
          className="rounded-xl bg-white/10 px-5 py-3 active:scale-90"
          onClick={addInspiration}
        >
          הוסיפי
        </button>
      </div>

      <p className="text-sm text-white/60">
        סמנו (בלחיצה) עד {MAX_SELECTED} השראות נבחרות - נבחרו {selectedCount}/{MAX_SELECTED}
      </p>

      {/* סטריפ ההשראות הנבחרות - ילווה גם שלבים הבאים (למשל שלב 4). */}
      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {items
          .filter((i) => i.selected)
          .map((i, idx) => (
            <span key={idx} className="rounded-full bg-accent-red px-3 py-1 text-xs">
              {i.text}
            </span>
          ))}
      </div>

      {selectedCount > 0 && (
        <button
          className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold transition-transform duration-100 active:scale-90"
          onClick={handleFinish}
        >
          סיימתי לבחור השראות
        </button>
      )}
    </main>
  );
}

export default Stage3Associations;
