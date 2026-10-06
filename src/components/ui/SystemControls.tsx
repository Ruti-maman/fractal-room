/*
 * ============================================================================
 *  פקדי מערכת - מצב תצוגה וחיווי חיבור
 * ============================================================================
 *
 *  שני הפקדים שיושבים מחוץ לתוכן הסדנה עצמה: החלפת מצב כהה/בהיר, וחיווי
 *  שאומר אם המסך מחובר לרשת. שניהם קטנים ושקטים בכוונה - הם לא חלק
 *  מהתהליך הפדגוגי, והם לא אמורים למשוך אליהם תשומת לב במהלך הסדנה.
 */

import { useEffect, useState } from "react";
import { cx } from "../../lib/cx";
import Icon from "./Icon";
import { GlassIconButton } from "./Glass";
import { useTheme } from "../../hooks/useTheme";

/* ==========================================================================
   מתג כהה / בהיר
   ========================================================================== */

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <GlassIconButton
      icon={isDark ? "moon" : "sun"}
      label={isDark ? "מעבר לתצוגה בהירה" : "מעבר לתצוגה כהה"}
      size="sm"
      onClick={toggleTheme}
      className={className}
    />
  );
}

/* ==========================================================================
   חיווי חיבור
   ========================================================================== */

/**
 * מצב החיבור של המסך. מבוסס על `navigator.onLine` ועל אירועי online/offline
 * של הדפדפן - בלי בקשות רשת נוספות משל עצמו.
 *
 * למה זה חשוב דווקא כאן: הוויי-פיי בחדר לא מובטח (סעיף 10 ב-CLAUDE.md),
 * והסינון עלול לנתק חיבורים. בלי חיווי, קבוצה שהמסך שלה התנתק פשוט רואה
 * מסך שלא מתקדם ולא מבינה למה.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/**
 * הנורה עצמה. כשהכול תקין היא כמעט בלתי נראית (נקודה קטנה בלבד), וברגע
 * שאין חיבור היא נפתחת לכיתוב מלא - חיווי שמופיע רק כשיש מה להגיד.
 */
export function ConnectionBadge({ className }: { className?: string }) {
  const online = useOnlineStatus();

  if (online) {
    return (
      <span
        className={cx("glass glass-dim glass-raised glass-icon-btn glass-icon-btn-sm text-ok", className)}
        title="מחוברת לרשת"
      >
        <span className="sr-only">מחוברת לרשת</span>
        <Icon name="wifi" size={18} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      role="alert"
      className={cx("glass glass-raised glass-pill text-warn gap-2 px-4 py-2 text-sm font-bold", className)}
      style={{ animation: "toast-in var(--ds-dur) var(--ds-ease-spring) both" }}
    >
      <Icon name="wifiOff" size={18} />
      אין חיבור לרשת
    </span>
  );
}
