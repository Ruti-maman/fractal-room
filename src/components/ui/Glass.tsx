/*
 * ============================================================================
 *  רכיבי הבסיס של שפת הזכוכית
 * ============================================================================
 *
 *  כל רכיב כאן הוא עטיפה דקה מעל המחלקות ב-styles/glass.css. הכלל: מסך
 *  לא כותב `bg-white/10 rounded-2xl border...` בעצמו אלא מרכיב מכאן, כדי
 *  שכל הזכוכית בפרויקט תהיה באמת אותה זכוכית.
 *
 *  כל הרכיבים מקבלים `className` ומעבירים `...rest`, כך שאפשר לכוונן
 *  מרווח/פריסה נקודתית בלי לשכפל את הרכיב.
 */

import {
  useRef,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../../lib/cx";
import { buzz, playTap } from "../../lib/tapFeedback";
import Icon, { type IconName } from "./Icon";
import { useHoldPress } from "./useHoldPress"; // HOLD
import { useTapRipple } from "./useTapRipple";

/*
 * HOLD (ניסוי 2026-11-11): כל כפתור "הבא" ראשי וגדול (primary + lg + חץ
 * המשך) עובד בהחזקה ולא בלחיצה - ראו useHoldPress.ts. `hold` על כפתור
 * בודד דורס את ברירת המחדל לשני הכיוונים. להסרה: false כאן, או למחוק את
 * כל השורות המסומנות HOLD.
 */
const HOLD_TO_ADVANCE = false; // בוטל 2026-11-11 לבקשת המפתחת: לחיצה רגילה מעבירה שלב

/* ==========================================================================
   משטח כללי
   ========================================================================== */

type Depth = "dim" | "base" | "strong" | "raised";

const DEPTH_CLASS: Record<Depth, string> = {
  dim: "glass-dim",
  base: "",
  strong: "glass-strong",
  raised: "glass-raised",
};

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** כמה "עבה" הזכוכית ביחס לרקע. raised = מודאל/שכבה עליונה. */
  depth?: Depth;
  /** תג ה-HTML שייווצר בפועל (section/article/aside...). ברירת מחדל div. */
  as?: ElementType;
  children?: ReactNode;
}

export function GlassSurface({
  depth = "base",
  as: Tag = "div",
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Tag className={cx("glass", DEPTH_CLASS[depth], className)} {...rest}>
      {children}
    </Tag>
  );
}

/** כרטיס גדול - פינות 38px, ריווח פנימי נדיב. יחידת התוכן המרכזית. */
export function GlassCard({ className, ...rest }: SurfaceProps) {
  return <GlassSurface className={cx("glass-card", className)} {...rest} />;
}

/** אריח squircle - פינות 32px, קומפקטי. לרשתות של פריטים. */
export function GlassTile({ className, ...rest }: SurfaceProps) {
  return <GlassSurface className={cx("glass-tile", className)} {...rest} />;
}

/** גלולה מאורכת - רצועות מידע, שורות סטטוס. */
export function GlassPill({ className, ...rest }: SurfaceProps) {
  return <GlassSurface className={cx("glass-pill", className)} {...rest} />;
}

/* ==========================================================================
   תגית
   ========================================================================== */

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: IconName;
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
  active?: boolean;
}

const CHIP_TONE: Record<NonNullable<ChipProps["tone"]>, string> = {
  neutral: "",
  accent: "text-accent-soft",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

/** תגית קטנה - "שלב 5 · שלב משותף", שם קבוצה, סטטוס. */
export function GlassChip({
  icon,
  tone = "neutral",
  active = false,
  className,
  children,
  ...rest
}: ChipProps) {
  return (
    <span
      className={cx("glass glass-chip", active && "glass-active", CHIP_TONE[tone], className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </span>
  );
}

/* ==========================================================================
   כפתורים
   ========================================================================== */

type Variant = "primary" | "glass" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "glass-btn-sm",
  md: "",
  lg: "glass-btn-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** אייקון לפני הטקסט. בממשק RTL "לפני" הוא בצד ימין. */
  icon?: IconName;
  /** אייקון אחרי הטקסט - בדרך כלל חץ המשך. */
  iconAfter?: IconName;
  /** מציג ספינר ומנטרל את הכפתור. הטקסט נשאר, כדי שהרוחב לא יקפוץ. */
  loading?: boolean;
  /** מתיחה לרוחב מלא של ההורה. */
  block?: boolean;
  /** בלי צליל הלחיצה (האדווה והרטט נשארים). */
  silent?: boolean;
  /** HOLD: הפעלה בהחזקה במקום בלחיצה. ברירת המחדל: כפתורי "הבא" הגדולים. */
  hold?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function GlassButton({
  variant = "glass",
  size = "md",
  icon,
  iconAfter,
  loading = false,
  block = false,
  silent = false,
  hold, // HOLD
  disabled,
  className,
  children,
  onPointerDown,
  onPointerUp, // HOLD
  onPointerCancel, // HOLD
  onLostPointerCapture, // HOLD
  onClick, // HOLD
  ref, // HOLD
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? 26 : size === "sm" ? 18 : 22;
  const { spawn, release, pressed, layer } = useTapRipple();

  // HOLD - התחלה
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const holdOn =
    (hold ?? (HOLD_TO_ADVANCE && variant === "primary" && size === "lg" && iconAfter === "arrowNext")) &&
    !disabled &&
    !loading;
  const holdPress = useHoldPress({
    enabled: holdOn,
    // click() יוצר אירוע עם detail=0 - בדיוק כמו מקלדת - ועובר במסנן למטה
    onComplete: () => innerRef.current?.click(),
  });
  // HOLD - סוף

  return (
    <button
      type="button"
      ref={(el) => {
        innerRef.current = el; // HOLD
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={(e) => {
        if (!disabled && !loading) {
          spawn(e);
          // HOLD: בהחזקה הצליל הראשי נשמר לסיום; בלחיצה רגילה כמו קודם
          if (!silent) playTap(variant === "primary" && !holdOn ? "primary" : "soft");
          buzz();
        }
        if (holdOn) holdPress.handlers.onPointerDown(e); // HOLD
        onPointerDown?.(e);
      }}
      // HOLD - התחלה (וגם: שחרור העיגול מתחת לאצבע)
      onPointerUp={(e) => {
        release();
        if (holdOn) holdPress.handlers.onPointerUp(e);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        if (holdOn) holdPress.handlers.onPointerCancel(e);
        onPointerCancel?.(e);
      }}
      onLostPointerCapture={(e) => {
        release();
        if (holdOn) holdPress.handlers.onLostPointerCapture(e);
        onLostPointerCapture?.(e);
      }}
      // לחיצת עכבר/מגע רגילה (detail>0) לא מפעילה כפתור החזקה; מקלדת
      // ו-click() (detail=0) כן - נגישות
      onClick={(e) => {
        if (holdOn && e.detail > 0) return;
        onClick?.(e);
      }}
      // HOLD - סוף
      className={cx(
        // glass-3d נותן לכפתור דופן, צל מקורקע ונסיעה בלחיצה (ראו glass.css).
        // `ghost` יוצא מהכלל: הוא כפתור "שטוח" בכוונה ואין לו גוף להרים.
        "glass glass-interactive glass-btn",
        variant !== "ghost" && "glass-3d",
        SIZE_CLASS[size],
        // כל כפתור ראשי באדום המלא של הלוגו, כמו "התחילו" (בקשת הלקוחה,
        // 2026-11-08: "תשנה את כל השלבים")
        variant === "primary" && "glass-btn-primary glass-btn-brand",
        variant === "ghost" && "!bg-transparent !shadow-none",
        variant === "danger" && "text-danger",
        block && "w-full",
        holdOn && "hold-btn", // HOLD
        pressed && !disabled && !loading && "is-pressed",
        className,
      )}
      {...rest}
      // אחרי {...rest} כדי שלא יידרס. בכפתור החזקה האצבע "נלכדת" ונשארת שלו
      // גם מחוצה לו - שם השחרור מגיע מ-onLostPointerCapture
      onPointerLeave={(e) => {
        if (!holdOn) release();
        rest.onPointerLeave?.(e);
      }}
    >
      {/* HOLD - התחלה */}
      {holdOn && (
        <span aria-hidden="true" className="hold-fill" style={{ ["--hold" as string]: holdPress.progress }} />
      )}
      {/* התגית מתחת לכפתור ("החזיקו כדי להמשיך" / "N אצבעות יחד") הוסרה
          לבקשת הלקוחה, 2026-11-11 */}
      {/* HOLD - סוף */}
      {layer}
      {loading ? (
        <Spinner size={iconSize} />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} size={iconSize} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** חובה - זהו הטקסט היחיד שקוראת מסך תמצא על כפתור אייקון. */
  label: string;
  size?: Size;
  /** דלוק = מילוי טורקיז זוהר, כבוי = זכוכית שקופה ועמומה. */
  active?: boolean;
  filled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const ICON_BTN_SIZE: Record<Size, string> = {
  sm: "glass-icon-btn-sm",
  md: "",
  lg: "glass-icon-btn-lg",
};

/**
 * הכפתור העגול של לוח הבקרה. ההבחנה בין דלוק לכבוי היא ליבת השפה:
 * דלוק = זכוכית שמוארת מבפנים, כבוי = זכוכית שקופה ואייקון עמום.
 */
export function GlassIconButton({
  icon,
  label,
  size = "md",
  active = false,
  filled = false,
  className,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  disabled,
  ...rest
}: IconButtonProps) {
  const { spawn, release, pressed, layer } = useTapRipple();

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (!disabled) {
          spawn(e);
          playTap("soft");
          buzz();
        }
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        release();
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        release();
        onPointerLeave?.(e);
      }}
      className={cx(
        "glass glass-interactive glass-icon-btn glass-3d",
        ICON_BTN_SIZE[size],
        active ? "glass-active" : "text-ink-2",
        pressed && !disabled && "is-pressed",
        className,
      )}
      {...rest}
    >
      {layer}
      <Icon name={icon} size={size === "lg" ? 30 : size === "sm" ? 20 : 24} filled={filled} />
    </button>
  );
}

/* ==========================================================================
   שדה קלט
   ========================================================================== */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** תווית גלויה. אם אין - חובה לתת `aria-label`. */
  label?: string;
  /** הודעת שגיאה מתחת לשדה. קיומה גם מסמן את השדה כשגוי לקוראת מסך. */
  error?: string;
  /** הסבר קצר מתחת לשדה. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

export function GlassInput({ label, error, hint, className, id, ...rest }: InputProps) {
  const autoId = id ?? rest.name;
  const describedBy = error ? `${autoId}-error` : hint ? `${autoId}-hint` : undefined;

  return (
    <div className={cx("flex w-full flex-col gap-2", className)}>
      {label && (
        <label htmlFor={autoId} className="text-ink-2 px-2 text-sm font-bold">
          {label}
        </label>
      )}
      <input
        id={autoId}
        className={cx("glass-input", error && "!shadow-[0_0_0_2px_var(--ds-danger)]")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={`${autoId}-error`} className="text-danger px-2 text-sm font-bold">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${autoId}-hint`} className="text-ink-3 px-2 text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
   ספינר
   ========================================================================== */

/**
 * טבעת טעינה. לא נקודות מהבהבות - טבעת אחת שמסתובבת קוראת נכון גם מרחוק
 * על מסך 65", וגם מתלבשת על הצורות העגולות של השפה.
 */
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="טוען"
      className={cx("inline-block flex-none rounded-full", className)}
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 10))}px solid var(--ds-glass-strong)`,
        borderTopColor: "var(--ds-accent)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
