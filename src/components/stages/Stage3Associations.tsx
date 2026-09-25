import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Group } from "../../types/group";
import type { Stage3Content, InspirationItem } from "../../types/stage3Content";
import { useInspirations } from "../../hooks/useInspirations";
import { useInspirationSelection } from "../../hooks/useInspirationSelection";

const MAX_SELECTED = 4;
const FLY_DURATION_MS = 550;

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

interface FlyingChip {
  key: number;
  text: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function fillSlots(items: InspirationItem[]) {
  return Array.from({ length: 7 }, (_, i) => items[i] ?? { text: "" });
}

/** צ'יפ שמדמה "תעופה" מהקרן שנבחרה אל תוך תיבת ההשראות למטה. */
function FlyingChipEl({ chip }: { chip: FlyingChip }) {
  const [atTarget, setAtTarget] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAtTarget(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pos = atTarget ? chip.to : chip.from;

  return (
    <span
      className="pointer-events-none fixed z-50 rounded-full bg-accent-red px-3 py-1 text-xs font-bold whitespace-nowrap text-white transition-all ease-in"
      style={{
        left: pos.x,
        top: pos.y,
        transform: `translate(-50%, -50%) scale(${atTarget ? 0.5 : 1})`,
        opacity: atTarget ? 0 : 1,
        transitionDuration: `${FLY_DURATION_MS}ms`,
      }}
    >
      {chip.text}
    </span>
  );
}

function Stage3Associations({ workshopId, myGroup, content, onAdvance }: Props) {
  const { items, loading: loadingText, mutate: mutateText } = useInspirations(workshopId);
  const { selected, loading: loadingSelection, mutate } = useInspirationSelection(workshopId, myGroup.id);
  const [showPopup, setShowPopup] = useState(false);
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  const flyKeyRef = useRef(0);

  // 7 משבצות קבועות (כמו במצגת) - items[i] קיים רק אחרי שנכתב בו משהו.
  const slots = fillSlots(items);
  const selectedCount = selected.length;
  const loading = loadingText || loadingSelection;

  function updateSlotText(index: number, text: string) {
    if (!text.trim()) return;
    // קוראים מחדש את המצב העדכני של הטקסט המשותף ממש לפני הכתיבה - כדי לא לדרוס מסך אחר שכתב כמעט באותו רגע.
    mutateText(myGroup.id, (current) => {
      const fresh = fillSlots(current);
      fresh[index] = { ...fresh[index], text };
      return fresh;
    });
  }

  function toggleSelected(index: number, e: MouseEvent<HTMLButtonElement>) {
    const localItem = slots[index];
    if (!localItem.text.trim()) return;

    const isSelected = selected.includes(index);
    if (!isSelected && stripRef.current) {
      const fromRect = e.currentTarget.getBoundingClientRect();
      const toRect = stripRef.current.getBoundingClientRect();
      const key = flyKeyRef.current++;
      setFlyingChips((chips) => [
        ...chips,
        {
          key,
          text: localItem.text,
          from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
          to: { x: toRect.left + 24, y: toRect.top + toRect.height / 2 },
        },
      ]);
      setTimeout(() => setFlyingChips((chips) => chips.filter((c) => c.key !== key)), FLY_DURATION_MS + 100);
    }

    mutate((current) => {
      if (current.includes(index)) return current.filter((i) => i !== index);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, index];
    });
  }

  // ברגע שהקבוצה שלנו בחרה את ההשראה הרביעית - קופץ פופ-אפ עם משפט חזק,
  // ומחכים ללחיצה על הכפתור לפני שעוברים הלאה (לפי המצגת, שקף 5).
  useEffect(() => {
    if (selectedCount === MAX_SELECTED && !showPopup) {
      setShowPopup(true);
    }
  }, [selectedCount, showPopup]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
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
        {/* מרכז השמש - הדילמה עצמה, נקראת מהמסד ולא כתובה בקוד (כלל הברזל
            בסעיף 4 ב-CLAUDE.md). העיגול גדל כדי שהטקסט המלא ייכנס. */}
        <div
          className="absolute flex h-56 w-56 items-center justify-center rounded-full bg-wood/60 p-5 text-center leading-snug font-bold"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          <span className={content.dilemma_text ? "text-sm" : "text-lg"}>
            {content.dilemma_text || "הדילמה שלנו"}
          </span>
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

        {/* 7 משבצות ההשראה - ריקה: שדה הקלדה. מלאה: כפתור שלוחצים עליו כדי לבחור (רק בחירה של הקבוצה שלנו). */}
        {RAY_ANGLES.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = RADIUS * Math.cos(rad);
          const y = -RADIUS * Math.sin(rad);
          const item = slots[i];
          const style = { left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` };
          const isSelected = selected.includes(i);

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
                isSelected ? "bg-accent-red font-bold" : "bg-white/10"
              }`}
              style={style}
              onClick={(e) => toggleSelected(i, e)}
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

      {/* תיבת ההשראות שנבחרו על ידינו - תלווה גם שלבים הבאים (למשל שלב 4). */}
      <div
        ref={stripRef}
        className="fixed bottom-6 left-1/2 flex min-h-10 min-w-48 -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-2"
      >
        {selected.length === 0 && <span className="text-xs text-white/40">ההשראות שתבחרו יופיעו כאן</span>}
        {selected.map((index) => (
          <span key={index} className="rounded-full bg-accent-red px-3 py-1 text-xs font-bold">
            {slots[index].text}
          </span>
        ))}
      </div>

      {flyingChips.map((chip) => (
        <FlyingChipEl key={chip.key} chip={chip} />
      ))}

      {showPopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
          <div className="flex max-w-lg flex-col items-center gap-6 rounded-3xl bg-smoke-blue-dark p-10 text-center shadow-2xl">
            <p className="text-3xl font-bold">{content.transition_text}</p>
            <button
              className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold active:scale-90"
              onClick={onAdvance}
            >
              לשלב הבא
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default Stage3Associations;
