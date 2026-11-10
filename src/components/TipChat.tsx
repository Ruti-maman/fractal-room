import { useEffect, useRef, useState } from "react";
import type { Tip } from "./TipPopups";
import GlassModal from "./ui/GlassModal";

/*
 * ============================================================================
 *  פופ-אפ טיפים לדיון (שלב 6) - "צ'אט של דיון"
 * ============================================================================
 *
 *  השלב הוא דיון, ולכן הטיפים מגיעים כמו קבוצת צ'אט: לפני כל טיפ מופיעות
 *  שלוש נקודות "מקלידה...", ואז הוא נוחת כבועת דיבור - לסירוגין מימין
 *  ומשמאל, כל "דוברת" בצבע משלה. שונה בכוונה מהשביל של שלב 2 (TipBubbles),
 *  כדי שהפרויקט לא יחזור על עצמו.
 *
 *  כפתור אחד בלבד, בלי × (אין שני כפתורים עם אותה פעולה).
 */

const TYPING_MS = 750;
const GAP_MS = 350;

function TipChat({
  open,
  onClose,
  title,
  tips,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tips: Tip[];
  confirmLabel: string;
}) {
  // כמה בועות כבר נחתו; typing = הנקודות של הבאה בתור מוצגות עכשיו
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(tips.length);
      return;
    }
    setShown(0);
    let at = 300;
    tips.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setTyping(true), at));
      at += TYPING_MS;
      timers.current.push(
        window.setTimeout(() => {
          setTyping(false);
          setShown(i + 1);
        }, at),
      );
      at += GAP_MS;
    });
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setTyping(false);
    };
    // tips.length ולא tips: תוכן מה-DB מגיע כאובייקט חדש בכל עדכון realtime,
    // וזה היה מתחיל את הצ'אט מחדש באמצע
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tips.length]);

  // צד הבועה: הראשונה מימין (תחילת השורה ב-RTL), ואז לסירוגין
  const sideOf = (i: number) => (i % 2 === 0 ? "start" : "end");

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      icon={false}
      confirmLabel={confirmLabel}
      onConfirm={onClose}
      hideCancel
      dismissable={false}
      // רקע צ'אט עכשווי ובועות לבנות (בקשת הלקוחה, 2026-11-08) - ראו .chat-surface
      className="chat-surface !max-w-4xl"
    >
      {/* כל הבועות במקומן מההתחלה (שקופות עד שהן "נשלחות") - כך החלון
          בגודלו הסופי מהרגע הראשון, ולא גדל וקופץ עם כל הודעה חדשה */}
      <ol className="flex flex-col gap-3 text-start" aria-live="polite">
        {tips.map((tip, i) => {
          const n = (i % 5) + 1;
          const start = sideOf(i) === "start";
          const visible = i < shown;
          const isTyping = typing && i === shown;
          return (
            <li
              key={tip.title}
              aria-hidden={!visible}
              className={`relative flex items-end gap-3 ${start ? "flex-row" : "flex-row-reverse"}`}
            >
              {/* ה"דוברת" - בועה קטנה בצבע שלה; מופיעה כבר כשהיא מקלידה */}
              {/* בתוכה מספר הטיפ - כדי שאפשר יהיה להגיד בדיון "נחזור לטיפ 3" */}
              <span
                aria-hidden="true"
                className={`bubble bubble--${n} flex h-11 w-11 flex-none items-center justify-center text-xl font-extrabold text-white ${visible || isTyping ? "" : "invisible"}`}
                style={{
                  textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  animation: visible || isTyping ? "pop-in 0.35s var(--ds-ease-spring) both" : undefined,
                }}
              >
                {i + 1}
              </span>

              {isTyping && (
                <div
                  aria-label="מקלידה..."
                  className={`absolute bottom-0 flex items-center gap-1.5 px-5 py-4 ${start ? "start-[4.25rem]" : "end-[4.25rem]"}`}
                  style={{
                    background: "var(--chat-bubble-bg, var(--ds-glass-opaque-raised))",
                    borderRadius: "var(--ds-r-md)",
                    animation: "chat-in 0.3s var(--ds-ease) both",
                  }}
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-2.5 w-2.5 diamond"
                      style={{
                        background: "var(--chat-ink, var(--ds-text-3))",
                        opacity: 0.45,
                        animation: `chat-typing 0.9s ${d * 0.15}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* בועת דיבור אמיתית: מסגרת בצבע הדוברת, וזנב (צוקציק) שיוצא
                  מהבועה אל העיגול שלה. רקע אטום - הזנב חייב להתמזג בה בלי תפר. */}
              <div
                className={`relative mx-3 max-w-[78%] px-5 py-3 ${visible ? "" : "invisible"}`}
                style={{
                  ["--from" as string]: start ? "24px" : "-24px",
                  animation: visible ? "chat-in 0.45s var(--ds-ease-spring) both" : undefined,
                  // בועה לבנה ואטומה, בלי מסגרת צבעונית - הצבע של הדוברת
                  // נשאר בכותרת הטיפ ובמעוין הממוספר
                  background: "var(--chat-bubble-bg, var(--ds-glass-opaque-raised))",
                  // צל נייבי רך - על הרקע הבהיר צל שחור נראה מלוכלך
                  boxShadow: "0 10px 26px -10px var(--chat-shadow, rgba(0, 0, 0, 0.45))",
                  // הפינה התחתונה שממנה יוצא הזנב - כמעט ישרה, כמו בבועת דיבור
                  borderRadius: start
                    ? "var(--ds-r-lg) var(--ds-r-lg) var(--ds-r-xs) var(--ds-r-lg)"
                    : "var(--ds-r-lg) var(--ds-r-lg) var(--ds-r-lg) var(--ds-r-xs)",
                  transformOrigin: start ? "bottom right" : "bottom left",
                }}
              >
                <svg
                  aria-hidden="true"
                  width={16}
                  height={18}
                  viewBox="0 0 16 18"
                  className="absolute overflow-visible"
                  style={{
                    bottom: 6,
                    [start ? "right" : "left"]: -16,
                    // הזנב מצויר כלפי ימין; לצד שמאל - בהיפוך מראה
                    transform: start ? undefined : "scaleX(-1)",
                  }}
                >
                  {/* המילוי נכנס 4px לתוך הבועה ומכסה את קו המסגרת בנקודת החיבור */}
                  <path
                    d="M-4 0 L0 0 L15 16 L0 11 L-4 11 Z"
                    style={{ fill: "var(--chat-bubble-bg, var(--ds-glass-opaque-raised))" }}
                  />
                </svg>
                <p className="text-xl leading-snug font-extrabold" style={{ color: `var(--ds-bubble-${n})` }}>
                  {tip.title}
                </p>
                {/* נייבי קבוע: הבועה תמיד לבנה, ו-text-ink במצב הכהה הוא כמעט
                    לבן - השורה נעלמה */}
                <p className="mt-0.5 text-lg leading-snug" style={{ color: "var(--chat-ink, var(--ds-text))", opacity: 0.8 }}>
                  {tip.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </GlassModal>
  );
}

export default TipChat;
