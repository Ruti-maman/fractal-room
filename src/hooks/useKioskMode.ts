import { useEffect } from "react";

let wakeLockSentinel: WakeLockSentinel | null = null;

/**
 * מבקשת מסך מלא ו-Wake Lock. חייבת להיקרא מתוך אירוע מגע/קליק אמיתי של המשתמשת
 * (הדפדפן חוסם את שתי הבקשות האלה בלי אינטראקציה) - ראו סעיף 2 ב-CLAUDE.md.
 * כרגע מחוברת לכפתור "הבא" הראשון, עד שייבנה כפתור "התחילו" האמיתי (משימה 5).
 */
export async function requestKioskPermissions() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // בדפדפן ישן/לא נתמך - ממשיכים בלי מסך מלא, לא עוצרים את הזרימה.
  }
  try {
    if ("wakeLock" in navigator && !wakeLockSentinel) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
  } catch {
    // אותו דבר - Wake Lock לא קריטי להמשך התהליך.
  }
}

// כשחוזרים לטאב אחרי שהוא היה ברקע, ה-Wake Lock משתחרר אוטומטית - מבקשים אותו מחדש.
async function reacquireWakeLockIfNeeded() {
  if (document.visibilityState === "visible" && "wakeLock" in navigator && !wakeLockSentinel) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch {
      // אין אינטראקציה טרייה כרגע - ננסה שוב בלחיצה הבאה.
    }
  }
}

/**
 * מפעילה את חלק מצב הקיוסק שלא תלוי במחוות משתמשת:
 * חסימת תפריט קליק-ימני, והתאוששות Wake Lock כשחוזרים למסך.
 * מניעת בחירת טקסט כבר מוגדרת גלובלית ב-src/index.css.
 */
export function useKioskMode() {
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("visibilitychange", reacquireWakeLockIfNeeded);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("visibilitychange", reacquireWakeLockIfNeeded);
    };
  }, []);
}
