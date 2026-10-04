import { useCallback, useState } from "react";

/*
 * ============================================================================
 *  מצב כהה / בהיר
 * ============================================================================
 *
 *  המצב נשמר ב-localStorage ונכתב כ-`data-theme` על <html>, שם כל טוקני
 *  הצבע מתחלפים (ראו styles/tokens.css). הפתרון הראשוני של המצב קורה
 *  בסקריפט קטן ב-index.html שרץ **לפני** הציור הראשון - כאן רק שומרים
 *  סנכרון ומאפשרים החלפה.
 *
 *  "system" אינו נשמר כערך: ברגע שהמשתמשת בחרה מצב, הבחירה מנצחת את
 *  המערכת. מי שמעולם לא בחרה - מקבלת את העדפת המערכת, ומעקב חי אחריה
 *  ממשיך כל עוד לא נבחר כלום.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "fractal-theme-v2";

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // אחסון חסום - המצב עדיין מתחלף, פשוט לא נזכר בפעם הבאה
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}

/*
 * ----------------------------------------------------------------------------
 *  מצב אפקטים מופחתים
 * ----------------------------------------------------------------------------
 *  ברז הביטחון של הפרויקט: backdrop-filter על WebView ישן של אנדרואיד עלול
 *  להיות איטי מאוד במסך מלא 1080p (סעיף 2 ב-CLAUDE.md). כיבוי כאן מחליף את
 *  כל הזכוכית למשטחים אטומים, בלי לגעת בשורת קוד ובלי לשנות פריסה.
 */

const EFFECTS_KEY = "fractal-effects";

export function useLiteEffects() {
  const [lite, setLiteState] = useState(
    () => document.documentElement.getAttribute("data-effects") === "lite",
  );

  const setLite = useCallback((next: boolean) => {
    if (next) {
      document.documentElement.setAttribute("data-effects", "lite");
    } else {
      document.documentElement.removeAttribute("data-effects");
    }
    setLiteState(next);
    try {
      localStorage.setItem(EFFECTS_KEY, next ? "lite" : "full");
    } catch {
      // אחסון חסום - ההגדרה תקפה למפגש הנוכחי בלבד
    }
  }, []);

  return { lite, setLite };
}
