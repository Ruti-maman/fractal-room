/*
 * ============================================================================
 *  גרירת המסך לשלב הבא
 * ============================================================================
 *
 *  במקום פופ-אפ עם כפתור "לשלב הבא" (בקשת הלקוחה, שקף 6 במצגת האפליקציה):
 *  כשהשלב הושלם, הקבוצה גוררת את המסך כולו ימינה או שמאלה - כמו דף -
 *  ומעבר לסף הוא עף החוצה ועוברים לשלב הבא. גרירה קצרה מדי חוזרת למקומה.
 *
 *  שני חלקים:
 *  - `useSwipeToAdvance` - המצב, ו-style שמזיזים בו את ה-<main> של השלב
 *    (StageShell מקבל אותו ב-`style`). הכרום הגלובלי (טיימר, מד התקדמות,
 *    סרגל עליון) יושב מחוץ ל-<main> ולכן נשאר במקומו.
 *  - `SwipeToAdvanceLayer` - שכבה שקופה על כל המסך שקולטת את הגרירה,
 *    וכרטיס הסבר באמצע. השכבה גם חוסמת נגיעות בתוכן שמתחת, כדי שגרירה
 *    שמתחילה על השראה לא תבחר אותה בטעות (בדיוק כמו הפופ-אפ שהיה קודם).
 *
 *  ה-transform מופעל רק כשהגרירה פעילה: transform על הורה הופך אותו לנקודת
 *  הייחוס של position:fixed (ראו סעיף 8.5 ב-CLAUDE.md). ה-<main> ממלא את
 *  החלון בדיוק, ולכן בזמן הגרירה זה לא מזיז אף אלמנט קבוע.
 */

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Icon from "./ui/Icon";

/** מרחק הגרירה שמעביר שלב: 18% מרוחב המסך, ולפחות 120px. */
const THRESHOLD_RATIO = 0.18;
const MIN_THRESHOLD_PX = 120;
const FLY_MS = 380;

type Phase = "drag" | "settle";

export interface SwipeState {
  active: boolean;
  /** style ל-<main> של השלב. undefined כשהגרירה לא פעילה. */
  shellStyle: CSSProperties | undefined;
  layerHandlers: {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: () => void;
  };
}

export function useSwipeToAdvance(active: boolean, onAdvance: () => void): SwipeState {
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<Phase>("settle");
  const startX = useRef<number | null>(null);
  const done = useRef(false);
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;

  useEffect(() => {
    if (!active) {
      done.current = false;
      startX.current = null;
      setDx(0);
    }
  }, [active]);

  function flyOut(direction: 1 | -1) {
    if (done.current) return;
    done.current = true;
    setPhase("settle");
    setDx(direction * window.innerWidth);
    window.setTimeout(() => advanceRef.current(), FLY_MS);
  }

  // מקלדת: חיצים ימינה/שמאלה עושים את אותו הדבר (נגישות, ובדיקה במחשב)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") flyOut(-1);
      else if (e.key === "ArrowRight") flyOut(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // flyOut קורא רק refs ו-setters, ולכן אין צורך להירשם מחדש
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function snapBack() {
    startX.current = null;
    setPhase("settle");
    setDx(0);
  }

  const layerHandlers: SwipeState["layerHandlers"] = {
    onPointerDown(e) {
      if (!active || done.current) return;
      startX.current = e.clientX;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setPhase("drag");
    },
    onPointerMove(e) {
      if (startX.current === null) return;
      setDx(e.clientX - startX.current);
    },
    onPointerUp(e) {
      if (startX.current === null) return;
      const distance = e.clientX - startX.current;
      startX.current = null;
      const threshold = Math.max(MIN_THRESHOLD_PX, window.innerWidth * THRESHOLD_RATIO);
      if (Math.abs(distance) >= threshold) flyOut(distance > 0 ? 1 : -1);
      else snapBack();
    },
    onPointerCancel: snapBack,
  };

  const progress = Math.min(Math.abs(dx) / window.innerWidth, 1);
  const shellStyle: CSSProperties | undefined = active
    ? {
        transform: `translateX(${dx}px) rotate(${(dx / window.innerWidth) * 3}deg)`,
        opacity: 1 - progress * 0.6,
        transition:
          phase === "drag"
            ? "none"
            : `transform ${FLY_MS}ms var(--ds-ease), opacity ${FLY_MS}ms var(--ds-ease)`,
      }
    : undefined;

  return { active, shellStyle, layerHandlers };
}

interface LayerProps {
  swipe: SwipeState;
  title: string;
  hint: string;
}

export function SwipeToAdvanceLayer({ swipe, title, hint }: LayerProps) {
  if (!swipe.active) return null;

  return (
    <div
      {...swipe.layerHandlers}
      // z-30: מעל התוכן ורצועת "נבחרו", אבל הסרגל העליון (z-40) נשאר לחיץ
      // הרקע מוחשך ומטושטש מאחורי הכרטיס - בלי זה טקסט השמש שמתחת נקרא
      // דרך הכרטיס והכול התערבב ("שיהיה יותר ברור")
      className="fixed inset-0 z-30 flex cursor-grab items-center justify-center bg-[var(--ds-scrim)] backdrop-blur-[6px] select-none active:cursor-grabbing"
      // בלי זה הדפדפן באנדרואיד לוקח לעצמו את הגרירה האופקית ושולח pointercancel
      style={{ touchAction: "none" }}
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${hint}`}
    >
      <div
        className="glass glass-raised pointer-events-none flex flex-col items-center gap-5 rounded-2xl px-10 py-8 text-center"
        // כרטיס אטום, לא זכוכית שקופה - הוא חייב להיקרא מעל כל מה שמתחתיו
        style={{
          animation: "pop-in var(--ds-dur) var(--ds-ease-spring) both",
          backgroundColor: "var(--ds-glass-opaque-raised)",
        }}
      >
        <span className="bubble bubble--1 flex h-16 w-16 items-center justify-center">
          <Icon name="check" size={30} />
        </span>
        <h2 className="glass-title text-3xl sm:text-4xl">{title}</h2>
        <div className="text-ink-2 flex items-center gap-4 text-lg font-bold sm:text-xl">
          <span style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite" }} className="text-accent flex">
            <Icon name="arrowBack" size={30} />
          </span>
          {hint}
          <span
            style={{ animation: "swipe-sway 1.6s var(--ds-ease) infinite reverse" }}
            className="text-accent flex"
          >
            <Icon name="arrowNext" size={30} />
          </span>
        </div>
      </div>
    </div>
  );
}
