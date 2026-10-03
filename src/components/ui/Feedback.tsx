/*
 * ============================================================================
 *  מצבי מסך: טעינה, ריק, שגיאה
 * ============================================================================
 *
 *  לכל מסך בסדנה יש שלושה מצבים חוץ מהמצב התקין, ובלעדיהם המערכת נראית
 *  שבורה בדיוק ברגעים שבהם הכי חשוב שתיראה שלטת. במקום "טוענת..." חשוף
 *  באמצע מסך של 65 אינץ', הרכיבים כאן נותנים מסך מלא ומעוצב.
 *
 *  עיקרון: מצב שגיאה תמיד מציע **פעולה**. משתתפת בחדר לא אמורה לקרוא
 *  הודעת שגיאה ולא לדעת מה לעשות איתה.
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import Icon, { type IconName } from "./Icon";
import { GlassButton, Spinner } from "./Glass";
import { BackgroundLayers } from "./AppBackground";

/* ==========================================================================
   שלד טעינה
   ========================================================================== */

/**
 * מלבן זכוכית עמום עם גל אור שעובר עליו. עדיף על ספינר כשידוע **מה**
 * נטען: המשתתפת רואה את מבנה המסך מתמלא במקום עיגול מסתובב.
 */
export function Skeleton({
  className,
  rounded = "md",
}: {
  className?: string;
  rounded?: "sm" | "md" | "full";
}) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "bg-glass",
        rounded === "full" ? "rounded-full" : rounded === "sm" ? "rounded-sm" : "rounded-md",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, var(--ds-glass-strong) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-sweep 1.6s ease-in-out infinite",
      }}
    />
  );
}

/** שלד של כרטיס שלב - כותרת, שורות טקסט וכפתור. */
export function StageSkeleton() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6" aria-hidden="true">
      <Skeleton className="h-8 w-40" rounded="full" />
      <Skeleton className="h-14 w-3/4" />
      <Skeleton className="h-5 w-1/2" rounded="full" />
      <div className="mt-4 grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="mt-4 h-16 w-56" rounded="full" />
    </div>
  );
}

/* ==========================================================================
   מסכי מצב מלאים
   ========================================================================== */

interface StateProps {
  title: string;
  description?: string;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}

/** מעטפת משותפת - מרכזת את התוכן על רקע מלא, עם ענף בוטני שקט. */
function StateShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <BackgroundLayers />
      <div
        className="glass glass-brick glass-card relative w-full max-w-xl text-center"
        style={{ animation: "glass-in var(--ds-dur-slow) var(--ds-ease) both" }}
      >
        {children}
      </div>
    </main>
  );
}

/** מסך טעינה מלא - כשעוד לא ידוע מה ייטען (לפני שהתוכנית נקראה). */
export function LoadingState({ title = "רגע אחד", description }: Partial<StateProps>) {
  return (
    <StateShell>
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* הילה שנושמת מאחורי הספינר - מרמזת שהמערכת חיה ולא תקועה */}
          <div
            className="bg-glow-soft absolute inset-0 rounded-full blur-xl"
            style={{ animation: "soft-pulse 2.4s ease-in-out infinite" }}
          />
          <Spinner size={64} className="relative" />
        </div>
        <div>
          <h1 className="glass-title mb-2 text-3xl">{title}</h1>
          {description && <p className="text-ink-2 text-lg">{description}</p>}
        </div>
      </div>
    </StateShell>
  );
}

/** מסך ריק - אין מה להציג, אבל זה לא תקלה. */
export function EmptyState({ title, description, icon = "info", children }: StateProps) {
  return (
    <StateShell>
      <div className="flex flex-col items-center gap-5">
        <div className="glass glass-icon-btn glass-icon-btn-lg text-accent-soft">
          <Icon name={icon} size={32} />
        </div>
        <div>
          <h1 className="glass-title mb-2 text-3xl">{title}</h1>
          {description && <p className="text-ink-2 text-lg leading-relaxed">{description}</p>}
        </div>
        {children}
      </div>
    </StateShell>
  );
}

/**
 * מסך שגיאה. תמיד עם פעולה: בחדר עומדות משתתפות מול מסך, וצריך להיות
 * ברור מה עושים עכשיו. פירוט טכני מוצג בקטן, כדי שיהיה אפשר לדווח עליו
 * בלי שהוא ישתלט על המסך.
 */
export function ErrorState({
  title = "משהו השתבש",
  description = "אפשר לנסות שוב. אם זה חוזר, קראו למנחה.",
  detail,
  onRetry,
  retryLabel = "לנסות שוב",
}: Partial<StateProps> & {
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <StateShell>
      <div className="flex flex-col items-center gap-5">
        <div className="glass glass-icon-btn glass-icon-btn-lg text-warn">
          <Icon name="alert" size={32} />
        </div>
        <div>
          <h1 className="glass-title mb-2 text-3xl">{title}</h1>
          <p className="text-ink-2 text-lg leading-relaxed">{description}</p>
        </div>

        {onRetry && (
          <GlassButton variant="primary" icon="refresh" onClick={onRetry} className="mt-2">
            {retryLabel}
          </GlassButton>
        )}

        {detail && (
          <details className="mt-2 w-full text-start">
            <summary className="text-ink-3 cursor-pointer text-sm font-bold">
              פרטים טכניים
            </summary>
            <p className="glass glass-dim mt-2 rounded-sm p-3 font-mono text-xs break-words">
              {detail}
            </p>
          </details>
        )}
      </div>
    </StateShell>
  );
}

/* ==========================================================================
   הודעה משובצת
   ========================================================================== */

/**
 * פס הודעה בתוך מסך קיים (לא מסך מלא) - למשל "לא הצלחנו לנסח את המשפט"
 * בתוך שלב שממשיך לעבוד.
 */
export function InlineNotice({
  tone = "warn",
  icon,
  title,
  children,
  className,
}: {
  tone?: "ok" | "warn" | "danger" | "info";
  icon?: IconName;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  // הרקע נצבע בגוון הסטטוס ולא נשאר זכוכית ניטרלית: הודעת אזהרה שנראית
  // בדיוק כמו כל כרטיס אחר על המסך פשוט לא נקראת כאזהרה.
  const toneClass =
    tone === "ok"
      ? "text-ok !bg-ok-fill"
      : tone === "danger"
        ? "text-danger !bg-danger-fill"
        : tone === "info"
          ? "text-accent-soft"
          : "text-warn !bg-warn-fill";

  const toneIcon: IconName =
    icon ?? (tone === "ok" ? "check" : tone === "info" ? "info" : "alert");

  return (
    <div
      role="status"
      className={cx(
        "glass glass-pill flex items-start gap-3 px-5 py-4 text-start",
        toneClass,
        className,
      )}
    >
      <Icon name={toneIcon} size={22} className="mt-0.5 flex-none" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-ink-2 text-sm leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

