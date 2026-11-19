/*
 * ============================================================================
 *  "הבא" בהחזקה - פעולה קבוצתית (ניסוי, 2026-11-11)
 * ============================================================================
 *
 *  במקום לחיצה, מחזיקים את הכפתור: פס מילוי נוסע לאורכו ובסופו הפעולה
 *  נורית. שתי סיבות:
 *   1. אין מעבר שלב בטעות (מרפק, ילדה, נגיעה כפולה) - בעיה אמיתית בקיוסק.
 *   2. על מסך מגע כל אצבע נוספת מאיצה את המילוי - ההסכמה הקבוצתית הופכת
 *      לתנועה פיזית משותפת.
 *
 *  התגית שהופיעה מתחת לכפתור ("החזיקו כדי להמשיך" / "N אצבעות יחד") הוסרה
 *  לבקשת הלקוחה (2026-11-11), ואיתה הרמז האוטומטי. לחיצה קצרה לא עושה כלום.
 *
 *  מקלדת (Enter/רווח) ו-`element.click()` עדיין מפעילים מיד - נגישות.
 *
 *  להסרה: למחוק את הקובץ הזה, את בלוק `.hold-*` ב-glass.css, ואת השורות
 *  המסומנות HOLD ב-Glass.tsx וב-Stage1Opening.tsx.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { buzz, playTap } from "../../lib/tapFeedback";

/** משך ההחזקה באצבע אחת. כל אצבע נוספת מקצרת (עד ארבע). */
const BASE_MS = 1000;

interface Options {
  enabled: boolean;
  onComplete: () => void;
}

export function useHoldPress({ enabled, onComplete }: Options) {
  const [progress, setProgress] = useState(0);

  const pointers = useRef(new Set<number>());
  const progressRef = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const fired = useRef(false);
  const quarter = useRef(0);
  const mounted = useRef(true);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const stopLoop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    last.current = 0;
  };

  const loop = useCallback(function step(now: number) {
    // זמן אמיתי ולא "פריימים": על פלזמה חלשה פריים יכול לקחת 70ms ויותר, ותקרה
    // נמוכה הייתה מאריכה את ההחזקה. התקרה רק מגינה מקפיצה אחרי לשונית מושהית.
    const dt = last.current ? Math.min(200, now - last.current) : 16;
    last.current = now;
    const n = pointers.current.size;
    let p = progressRef.current;
    if (n > 0) {
      // אצבע שנייה: פי 1.6; שלישית: פי 2.2; רביעית: פי 2.8
      p += (dt / BASE_MS) * (1 + 0.6 * (Math.min(n, 4) - 1));
    } else {
      // עזבו באמצע - המילוי נסוג מהר, כמו קפיץ
      p -= dt / (BASE_MS * 0.3);
    }
    p = Math.max(0, Math.min(1, p));
    progressRef.current = p;
    setProgress(p);

    // טיק רטט קטן בכל רבע - מרגישים את ההתקדמות גם בלי להסתכל
    const q = Math.floor(p * 4);
    if (n > 0 && q !== quarter.current && q > 0 && q < 4) buzz(6);
    quarter.current = q;

    if (p >= 1 && !fired.current) {
      fired.current = true;
      pointers.current.clear();
      buzz(28);
      playTap("primary");
      stopLoop();
      onCompleteRef.current();
      window.setTimeout(() => {
        if (!mounted.current) return;
        progressRef.current = 0;
        setProgress(0);
        fired.current = false;
      }, 260);
      return;
    }
    if (p <= 0 && n === 0) {
      stopLoop();
      return;
    }
    raf.current = requestAnimationFrame(step);
  }, []);

  const ensureLoop = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  }, [loop]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || fired.current) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // דפדפן ישן בלי pointer capture - עדיין עובד, רק בלי מעקב מחוץ לכפתור
      }
      pointers.current.add(e.pointerId);
      ensureLoop();
    },
    [enabled, ensureLoop],
  );

  const release = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      ensureLoop();
    },
    [ensureLoop],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return {
    progress,
    handlers: {
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
    },
  };
}
