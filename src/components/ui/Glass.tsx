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
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../../lib/cx";
import { buzz, playTap } from "../../lib/tapFeedback";
import Icon, { type IconName } from "./Icon";

/* ==========================================================================
   משוב מגע
   ========================================================================== */

/**
 * אדוות מגע. כל נגיעה יוצרת עיגול שמתפשט **מנקודת הנגיעה עצמה** ונמוג.
 *
 * למה זה לא קישוט: על מסך מגע אין סמן ואין hover, והאצבע מכסה בדיוק את
 * מה שנגעו בו. בלי משוב שיוצא מתחת לאצבע אין שום דרך לדעת אם הלחיצה
 * נקלטה - וזו הסיבה המרכזית שמשתתפת לוחצת פעמיים.
 *
 * ה-timeout לא מנוקה בכוונה: `setRipples` על רכיב שכבר ירד הוא no-op
 * ב-React 18+, והאדווה ממילא נעלמת יחד עם הכפתור.
 */
function useTapRipple() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = nextId.current++;
    setRipples((current) => [
      ...current,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
    window.setTimeout(
      () => setRipples((current) => current.filter((r) => r.id !== id)),
      560,
    );
  }, []);

  const layer =
    ripples.length > 0 ? (
      <span className="tap-ripples" aria-hidden="true">
        {ripples.map((r) => (
          <span key={r.id} className="tap-ripple" style={{ left: r.x, top: r.y }} />
        ))}
      </span>
    ) : null;

  return { spawn, layer };
}

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
  disabled,
  className,
  children,
  onPointerDown,
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? 26 : size === "sm" ? 18 : 22;
  const { spawn, layer } = useTapRipple();

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={(e) => {
        if (!disabled && !loading) {
          spawn(e);
          if (!silent) playTap(variant === "primary" ? "primary" : "soft");
          buzz();
        }
        onPointerDown?.(e);
      }}
      className={cx(
        // glass-3d נותן לכפתור דופן, צל מקורקע ונסיעה בלחיצה (ראו glass.css).
        // `ghost` יוצא מהכלל: הוא כפתור "שטוח" בכוונה ואין לו גוף להרים.
        "glass glass-interactive glass-btn",
        variant !== "ghost" && "glass-3d",
        SIZE_CLASS[size],
        variant === "primary" && "glass-btn-primary",
        variant === "ghost" && "!bg-transparent !shadow-none",
        variant === "danger" && "text-danger",
        block && "w-full",
        className,
      )}
      {...rest}
    >
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
  disabled,
  ...rest
}: IconButtonProps) {
  const { spawn, layer } = useTapRipple();

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
      className={cx(
        "glass glass-interactive glass-icon-btn glass-3d",
        ICON_BTN_SIZE[size],
        active ? "glass-active" : "text-ink-2",
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
