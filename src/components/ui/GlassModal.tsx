/*
 * ============================================================================
 *  מודאל זכוכית
 * ============================================================================
 *
 *  לבנת זכוכית עבה שצפה מעל הדף, עם הרקע מטושטש מאחוריה. מחליף גם את
 *  `window.confirm` של הדפדפן - דיאלוג מערכת באמצע מסך סדנה על פלזמה
 *  שובר את האשליה לגמרי, וגם לא ניתן לעיצוב או לתרגום.
 *
 *  נגישות: `role="dialog"` + `aria-modal`, מיקוד נכנס פנימה בפתיחה וחוזר
 *  למקום בסגירה, Escape סוגר, Tab לא בורח מהמודאל, ולחיצה על הרקע סוגרת
 *  (אלא אם זו פעולה הרסנית - ראו `dismissable`).
 */

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import Icon, { type IconName } from "./Icon";
import { GlassButton, GlassIconButton } from "./Glass";

type Tone = "neutral" | "ok" | "warn" | "danger";

const TONE_ICON: Record<Tone, IconName> = {
  neutral: "info",
  ok: "check",
  warn: "alert",
  danger: "alert",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-accent-soft",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

interface Props {
  open: boolean;
  title: string;
  /** טקסט הסבר. אפשר במקומו להעביר children לתוכן מורכב. */
  description?: string;
  children?: ReactNode;
  tone?: Tone;
  /** מוסתר כשלא צריך אייקון בכלל (למשל מודאל תוכן ולא הודעה). */
  icon?: IconName | false;
  /** כפתור הפעולה הראשי. בלעדיו מוצג רק כפתור סגירה. */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  cancelLabel?: string;
  onClose?: () => void;
  /** false = אי אפשר לסגור ברקע/Escape. לפעולות הרסניות ולמצבי חובה. */
  dismissable?: boolean;
  className?: string;
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

function GlassModal({
  open,
  title,
  description,
  children,
  tone = "neutral",
  icon,
  confirmLabel,
  onConfirm,
  confirmLoading = false,
  cancelLabel = "סגירה",
  onClose,
  dismissable = true,
  className,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (dismissable) onClose?.();
  }, [dismissable, onClose]);

  // מיקוד: נכנס פנימה בפתיחה, חוזר למקור בסגירה
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    return () => restoreFocusRef.current?.focus?.();
  }, [open]);

  // Escape סוגר, ו-Tab נשאר בתוך המודאל
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;

      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, requestClose]);

  if (!open) return null;

  const iconName = icon === false ? null : (icon ?? TONE_ICON[tone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ animation: "backdrop-in var(--ds-dur) ease-out" }}
    >
      {/* הרקע: מכהה ומטשטש את המסך שמאחור, כך שהמודאל באמת "צף" */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={requestClose}
        className={cx(
          "absolute inset-0 bg-[var(--ds-scrim)] backdrop-blur-[6px]",
          !dismissable && "cursor-default",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-desc" : undefined}
        tabIndex={-1}
        className={cx(
          "glass glass-raised glass-brick glass-card relative w-full max-w-lg text-center outline-none",
          className,
        )}
        style={{ animation: "pop-in var(--ds-dur-slow) var(--ds-ease-spring)" }}
      >
        {dismissable && onClose && (
          <GlassIconButton
            icon="close"
            label="סגירה"
            size="sm"
            onClick={onClose}
            className="absolute top-4 left-4"
          />
        )}

        {iconName && (
          <div
            className={cx(
              "glass glass-icon-btn glass-icon-btn-lg mx-auto mb-6",
              TONE_CLASS[tone],
            )}
            style={{
              animation: "bounce-in var(--ds-dur-slow) var(--ds-ease-spring) 80ms both",
            }}
          >
            <Icon name={iconName} size={34} />
          </div>
        )}

        <h2 id="modal-title" className="glass-title mb-3 text-3xl">
          {title}
        </h2>

        {description && (
          <p id="modal-desc" className="text-ink-2 mb-2 text-lg leading-relaxed">
            {description}
          </p>
        )}

        {children && <div className="mt-4">{children}</div>}

        {(confirmLabel || onClose) && (
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            {onClose && (
              <GlassButton onClick={onClose} block className="sm:w-auto">
                {cancelLabel}
              </GlassButton>
            )}
            {confirmLabel && (
              <GlassButton
                variant={tone === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
                loading={confirmLoading}
                block
                className="sm:w-auto"
              >
                {confirmLabel}
              </GlassButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GlassModal;
