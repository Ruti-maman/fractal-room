import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Group } from "../../types/group";
import type { Stage3Content, InspirationItem } from "../../types/stage3Content";
import { useInspirations } from "../../hooks/useInspirations";
import { useInspirationSelection } from "../../hooks/useInspirationSelection";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import GlassModal from "../ui/GlassModal";
import { Spinner } from "../ui/Glass";
import { cx } from "../../lib/cx";

const MAX_SELECTED = 4;
const FLY_DURATION_MS = 550;

/**
 * זוויות 7 הקרניים סביב השמש (מעלות, 0=ימין, סיבוב נגד כיוון השעון) - חולצו
 * ישירות ממיקומי הצורות בשקף 5 במצגת (docs/מצגת.pptx). שימו לב לפער למעלה -
 * זה במקור, לא טעות. **אסור לשנות** - זה המיקום המדויק מהמצגת של הלקוחה.
 */
const RAY_ANGLES = [42, 4, -32, -90, -148, 176, 143];
const RADIUS = 230;

/** טבעת הטעינה סביב הליבה - רדיוס והיקף, לחישוב ה-strokeDasharray. */
const CORE_RING = 128;
const CORE_CIRC = 2 * Math.PI * CORE_RING;

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
      className="glass glass-active pointer-events-none fixed z-50 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all ease-in"
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

/**
 * שלב 3 - שמש האסוציאציות (שקף 5 במצגת).
 *
 * ההשראות עצמן **משותפות לשלוש הקבוצות** (מה שקבוצה אחת מקלידה מופיע אצל
 * כולן), אבל ה**בחירה** היא של כל קבוצה בנפרד, וכך גם המעבר לשלב הבא.
 * ראו ההסבר המלא בסעיף 8.5 ב-CLAUDE.md.
 *
 * ----------------------------------------------------------------------------
 * העיצוב: טעינת מקור אור
 * ----------------------------------------------------------------------------
 * זה המסך הכי "משחקי" בסדנה, והמכניקה שלו היא **טעינה**: הליבה במרכז
 * מתחילה עמומה, וכל השראה שנבחרת מזינה אותה. שלושה דברים זזים יחד עם
 * `charge` (0 עד 1):
 *   - טבעת טעינה סביב הליבה מתמלאת,
 *   - ההילה גדלה והליבה מתנפחת קלות וזוהרת חזק יותר,
 *   - הקרן שנבחרה נדלקת, ופולס אור רץ לאורכה **פנימה** אל הליבה.
 *
 * זה הופך את הבחירה מ"לחצתי על כפתור" ל"הזנתי את השמש", וזה גם מה שעונה
 * בלי מילים על "כמה עוד נשאר".
 *
 * הרדיוס והזוויות נשארו בדיוק כפי שחולצו מהמצגת. כדי שזה לא יישבר על מסך
 * צר, השמש כולה מוקטנת פרופורציונלית (`scale`) במקום לשנות את הגאומטריה -
 * כך המיקום היחסי של כל קרן נשמר מדויק בכל רוחב מסך.
 */
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
      <StageShell stage={3} kicker="שמש אסוציאציות" icon="sun" title="טוענת את ההשראות">
        <Spinner size={56} />
      </StageShell>
    );
  }

  const remaining = MAX_SELECTED - selectedCount;
  // 0 עד 1. זה מה שמניע את טבעת הטעינה, גודל ההילה ועוצמת הזוהר של
  // הליבה - כך שהשלב מרגיש כמו טעינת מקור אור ולא כמו מילוי טופס.
  const charge = selectedCount / MAX_SELECTED;

  return (
    <StageShell
      stage={3}
      kicker="שמש אסוציאציות"
      icon="sun"
      title="מה עולה לכן מהדילמה?"
      subtitle="השלימו את ההשראות סביב השמש, ובחרו את הארבע החזקות ביותר."
      background="radiant"
      width="full"
      className="!pb-56"
      overlay={
        <>
          {/*
            תיבת ההשראות שנבחרו.

            היא יושבת כאן, ב-overlay, ולא בתוך גוף השלב - וזה הכרחי ולא
            עניין של סדר: גוף השלב מונפש ב-transform (fade-up), ואלמנט
            עם transform הופך לנקודת הייחוס של position:fixed במקום
            החלון. כשהרצועה הייתה שם, ה-bottom שלה נמדד מתחתית התוכן
            המונפש והיא ריחפה באמצע השמש במקום להיצמד לתחתית המסך.
          */}
          <div
            ref={stripRef}
            // bottom משתנה לפי רוחב: על מסך רחב הרצועה יושבת נמוך, בין מד
            // ההתקדמות לטיימר שנמצאים בקצוות. על מסך צר אין ביניהם מקום,
            // ולכן היא עולה מעליהם במקום להתנגש בהם.
            className="glass glass-brick fixed bottom-[12rem] left-1/2 z-30 flex min-h-[4.25rem] w-[min(92vw,44rem)] -translate-x-1/2 items-center gap-3 rounded-xl px-5 py-3 lg:bottom-24"
          >
            <span className="text-ink-3 flex flex-none items-center gap-1.5 text-[11px] font-bold">
              <Icon name="star" size={14} className="text-accent-soft" />
              נבחרו
              <span className="text-accent text-sm tabular-nums">
                {selectedCount}/{MAX_SELECTED}
              </span>
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {selected.length === 0 ? (
                <span className="text-ink-3 text-xs">
                  לחצו על השראה בשמש כדי לבחור אותה
                </span>
              ) : (
                selected.map((index) => (
                  <span
                    key={index}
                    className="glass glass-active glass-chip !text-[13px]"
                    style={{ animation: "pop-in var(--ds-dur) var(--ds-ease-spring) both" }}
                  >
                    {slots[index].text}
                  </span>
                ))
              )}
            </div>

            {remaining > 0 && remaining <= 2 && (
              <span className="text-accent-soft flex-none text-xs font-bold">
                {remaining === 1 ? "עוד אחת ועוברים!" : `עוד ${remaining}`}
              </span>
            )}
          </div>

          {flyingChips.map((chip) => (
            <FlyingChipEl key={chip.key} chip={chip} />
          ))}

          <GlassModal
            open={showPopup}
            title={content.transition_text ?? "בחרתן את ההשראות שלכן"}
            icon="sparkles"
            tone="ok"
            confirmLabel="לשלב הבא"
            onConfirm={onAdvance}
            dismissable={false}
          />
        </>
      }
    >
      {/* --- השמש --- */}
      <div className="flex w-full justify-center">
        <div className="origin-center scale-[0.52] sm:scale-[0.72] lg:scale-90 xl:scale-100">
          <div
            className="relative"
            style={{ width: RADIUS * 2 + 200, height: RADIUS * 2 + 120 }}
          >
            {/* ההילה גדלה ומתחזקת ככל שהליבה נטענת */}
            <div
              aria-hidden="true"
              className="bg-glow-soft absolute top-1/2 left-1/2 rounded-full blur-[90px] transition-all duration-700"
              style={{
                width: 360 + charge * 140,
                height: 360 + charge * 140,
                transform: "translate(-50%, -50%)",
                opacity: 0.45 + charge * 0.45,
                animation: "soft-pulse 6s ease-in-out infinite",
              }}
            />

            {/* קווי הקרניים. קרן שנבחרה **נדלקת** ופולסת פנימה אל הליבה -
                זה מה שהופך את הבחירה לפעולה שמזינה את השמש, ולא רק
                לכפתור שמשנה צבע. */}
            {RAY_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 92 * Math.cos(rad);
              const y1 = -92 * Math.sin(rad);
              const x2 = (RADIUS - 44) * Math.cos(rad);
              const y2 = -(RADIUS - 44) * Math.sin(rad);
              const length = Math.hypot(x2 - x1, y2 - y1);
              const lineAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
              const lit = selected.includes(i);

              return (
                <div
                  key={`line-${i}`}
                  aria-hidden="true"
                  className="absolute overflow-hidden rounded-full transition-all duration-500"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: length,
                    height: lit ? 6 : 2,
                    background: lit
                      ? "linear-gradient(90deg, var(--ds-accent-pale), var(--ds-accent))"
                      : "var(--ds-edge)",
                    boxShadow: lit ? "0 0 18px 1px var(--ds-glow)" : "none",
                    opacity: lit ? 1 : 0.45,
                    transform: `translate(${x1}px, ${y1}px) rotate(${lineAngle}deg) translateY(${lit ? -3 : -1}px)`,
                    transformOrigin: "0 0",
                  }}
                >
                  {/* פולס האנרגיה שרץ לאורך הקרן פנימה */}
                  {lit && (
                    <span
                      className="absolute inset-y-0 w-1/3"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, #ffffff, transparent)",
                        opacity: 0.85,
                        animation: `ray-pulse 2.4s ${i * 0.3}s linear infinite`,
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* --- הליבה --- */}
            <div
              className="absolute"
              style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
            >
              {/* טבעת הטעינה סביב הליבה - מד ההתקדמות של השלב */}
              <svg
                viewBox="0 0 280 280"
                className="pointer-events-none absolute -inset-4 -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r={CORE_RING}
                  fill="none"
                  stroke="var(--ds-glass-strong)"
                  strokeWidth="5"
                />
                <circle
                  cx="140"
                  cy="140"
                  r={CORE_RING}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CORE_CIRC}
                  strokeDashoffset={CORE_CIRC * (1 - charge)}
                  style={{
                    transition: "stroke-dashoffset 600ms var(--ds-ease-spring)",
                    filter: "drop-shadow(0 0 8px var(--ds-glow))",
                  }}
                />
              </svg>

              <div
                className="glass glass-brick relative flex h-60 w-60 items-center justify-center rounded-full p-7 text-center transition-all duration-500"
                style={{
                  transform: `scale(${1 + charge * 0.06})`,
                  boxShadow: `var(--ds-shadow-lg), 0 0 ${40 + charge * 70}px -6px var(--ds-glow), var(--ds-inset-top)`,
                }}
              >
                <span
                  className={cx(
                    "font-extrabold leading-snug",
                    content.dilemma_text ? "text-base" : "text-xl",
                  )}
                >
                  {content.dilemma_text || "הדילמה שלנו"}
                </span>
              </div>
            </div>

            {/* 7 משבצות ההשראה */}
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
                    className="glass-input absolute w-40 -translate-x-1/2 -translate-y-1/2 !min-h-[3.5rem] !px-3 text-center !text-base"
                    style={style}
                    placeholder="כתבו כאן"
                    aria-label={`השראה ${i + 1}`}
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
                  type="button"
                  aria-pressed={isSelected}
                  className={cx(
                    "glass glass-interactive absolute w-40 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-4 text-center text-base font-bold",
                    isSelected && "glass-active",
                  )}
                  style={{
                    ...style,
                    ...(isSelected
                      ? { boxShadow: "var(--ds-shadow), 0 0 30px -2px var(--ds-glow)" }
                      : null),
                  }}
                  onClick={(e) => toggleSelected(i, e)}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </StageShell>
  );
}

export default Stage3Associations;
