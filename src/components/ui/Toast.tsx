/*
 * ============================================================================
 *  הודעות צפות (Toasts)
 * ============================================================================
 *
 *  עד עכשיו פעולות בסדנה היו שקטות: קבוצה לחצה "שמרי" בהזדהות, ושום דבר
 *  על המסך לא אישר שזה קרה. על מסך 65" בחדר עם שלוש קבוצות, "לא קרה כלום"
 *  מתפרש כתקלה והלחיצה חוזרת. ההודעות כאן סוגרות את הלולאה הזאת.
 *
 *  כללים:
 *  - הודעה היא **משוב**, לא דיאלוג. היא לא חוסמת ולא דורשת סגירה.
 *  - שגיאה נשארת ארוך יותר מהצלחה, כי צריך להספיק לקרוא ולהחליט.
 *  - `role="status"` + `aria-live="polite"` כדי שקוראת מסך תקריא אותה
 *    בלי לקטוע את מה שמוקרא כרגע.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../../lib/cx";
import Icon, { type IconName } from "./Icon";

type ToastTone = "ok" | "warn" | "danger" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  icon?: IconName;
}

type ShowToast = (message: string, options?: { tone?: ToastTone; icon?: IconName }) => void;

const ToastContext = createContext<ShowToast | null>(null);

const TONE_ICON: Record<ToastTone, IconName> = {
  ok: "check",
  warn: "alert",
  danger: "alert",
  info: "info",
};

const TONE_CLASS: Record<ToastTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-accent-soft",
};

const DURATION: Record<ToastTone, number> = {
  ok: 2600,
  info: 3200,
  warn: 4800,
  danger: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message, options) => {
    const tone = options?.tone ?? "ok";
    const id = nextId.current++;

    setToasts((current) => [...current, { id, tone, message, icon: options?.icon }]);
    // אין צורך לנקות את הטיימר: גם אם הרכיב יורד, setToasts על מערך שכבר
    // לא מוצג הוא no-op ב-React 18+, וההודעה ממילא נעלמה יחד עם הדף.
    window.setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      DURATION[tone],
    );
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-4 right-0 left-0 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cx(
              "glass glass-raised glass-pill pointer-events-auto max-w-[min(92vw,34rem)] gap-3 px-6 py-3.5 text-base font-bold shadow-glass-lg",
              TONE_CLASS[toast.tone],
            )}
            style={{ animation: "toast-in var(--ds-dur) var(--ds-ease-spring) both" }}
          >
            <Icon name={toast.icon ?? TONE_ICON[toast.tone]} size={20} className="flex-none" />
            <span className="text-ink">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * הצגת הודעה. שימוש:
 *   const toast = useToast();
 *   toast("נשמר", { tone: "ok" });
 *
 * מחוץ ל-ToastProvider מחזיר פונקציה ריקה במקום לזרוק - כך רכיב שנבדק
 * בבידוד לא נופל רק בגלל שאין לו ספק הודעות.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  return show ?? (() => {});
}
