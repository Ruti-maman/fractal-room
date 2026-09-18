import { useEffect, useState } from "react";
import type { Group } from "../../types/group";
import type { Stage3Content } from "../../types/stage3Content";
import { useInspirations } from "../../hooks/useInspirations";

const MAX_SELECTED = 4;

/**
 * זוויות 7 הקרניים סביב השמש (מעלות, 0=ימין, סיבוב נגד כיוון השעון) - חולצו
 * ישירות ממיקומי הצורות בשקף 5 במצגת (docs/מצגת.pptx). שימו לב לפער למעלה -
 * זה במקור, לא טעות.
 */
const RAY_ANGLES = [42, 4, -32, -90, -148, 176, 143];
const RADIUS = 230;

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage3Content;
  onAdvance: () => void;
}

function Stage3Associations({ workshopId, myGroup, content, onAdvance }: Props) {
  const { items, loading, save } = useInspirations(workshopId, myGroup.id);
  const [showingTransition, setShowingTransition] = useState(false);

  // 7 משבצות קבועות (כמו במצגת) - items[i] קיים רק אחרי שנכתב בו משהו.
  const slots = Array.from({ length: 7 }, (_, i) => items[i] ?? { text: "", selected: false });
  const selectedCount = items.filter((i) => i.selected).length;

  function updateSlotText(index: number, text: string) {
    const next = slots.slice();
    next[index] = { ...next[index], text };
    save(next);
  }

  function toggleSelected(index: number) {
    const item = slots[index];
    if (!item.text.trim()) return;
    if (!item.selected && selectedCount >= MAX_SELECTED) return;
    const next = slots.slice();
    next[index] = { ...item, selected: !item.selected };
    save(next);
  }

  // ברגע שנבחרה ההשראה הרביעית - עוברים אוטומטית, בלי כפתור "סיימתי" (לפי המצגת, שקף 5).
  useEffect(() => {
    if (selectedCount === MAX_SELECTED && !showingTransition) {
      setShowingTransition(true);
      setTimeout(onAdvance, 2000);
    }
  }, [selectedCount, showingTransition, onAdvance]);

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
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">שמש אסוציאציות</h1>
      <p className="text-sm text-white/60">
        השלימו את ההשראות מסביב. לחצו על השראה טובה כדי להעתיק אותה ל"סטריפ" למטה!
      </p>

      <div className="relative my-6" style={{ width: RADIUS * 2 + 160, height: RADIUS * 2 + 60 }}>
        {/* השמש - עיגול מרכזי */}
        <div
          className="absolute flex h-40 w-40 items-center justify-center rounded-full bg-wood/60 text-center text-lg font-bold"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          הדילמה שלנו
        </div>

        {/* קווי הקרניים (מהעיגול החוצה) */}
        {RAY_ANGLES.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 80 * Math.cos(rad);
          const y1 = -80 * Math.sin(rad);
          const x2 = (RADIUS - 40) * Math.cos(rad);
          const y2 = -(RADIUS - 40) * Math.sin(rad);
          const length = Math.hypot(x2 - x1, y2 - y1);
          const lineAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
          return (
            <div
              key={`line-${i}`}
              className="absolute bg-white/20"
              style={{
                left: "50%",
                top: "50%",
                width: length,
                height: 2,
                transform: `translate(${x1}px, ${y1}px) rotate(${lineAngle}deg)`,
                transformOrigin: "0 0",
              }}
            />
          );
        })}

        {/* 7 משבצות ההשראה - ריקה: שדה הקלדה. מלאה: כפתור שלוחצים עליו כדי לבחור. */}
        {RAY_ANGLES.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = RADIUS * Math.cos(rad);
          const y = -RADIUS * Math.sin(rad);
          const item = slots[i];
          const style = { left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` };

          if (!item.text.trim()) {
            return (
              <input
                key={i}
                className="absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-center text-sm outline-none"
                style={style}
                placeholder="_____________"
                onBlur={(e) => updateSlotText(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            );
          }

          return (
            <button
              key={i}
              className={`absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-center text-sm transition-transform active:scale-90 ${
                item.selected ? "bg-accent-red font-bold" : "bg-white/10"
              }`}
              style={style}
              onClick={() => toggleSelected(i)}
            >
              {item.text}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-white/60">
        נבחרו {selectedCount}/{MAX_SELECTED}
        {selectedCount === MAX_SELECTED - 1 && " (עוד אחת ועוברים הלאה!)"}
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
    </main>
  );
}

export default Stage3Associations;
