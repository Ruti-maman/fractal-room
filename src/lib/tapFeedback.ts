/*
 * ============================================================================
 *  משוב מגע
 * ============================================================================
 *
 *  הסדנה רצה על מסכי מגע גדולים, והיא אמורה להרגיש כמו משחק ולא כמו טופס.
 *  שני דברים עושים את ההבדל ברגע הנגיעה:
 *
 *  1. **אדווה מנקודת המגע** (ראו .tap-ripple ב-glass.css) - במסך מגע אין
 *     סמן ואין hover, ולכן זו הדרך היחידה להגיד "נגעת **כאן**, זה נקלט".
 *  2. **צליל קצר** - מה שהופך לחיצה למספקת. רך ונמוך בכוונה: שלוש
 *     פלזמות בחדר אחד, וצליל בולט משלושה כיוונים היה הופך לרעש.
 *
 *  הצליל נוצר ב-Web Audio ולא מקובץ: אין CDN (סעיף 2 ב-CLAUDE.md), ולא
 *  שווה להוסיף קובץ שמע ל-build בשביל טיק אחד.
 *
 *  **חייב נגיעה קודמת בדף** כדי שהדפדפן ירשה קול - וזו בדיוק הלחיצה על
 *  "התחילו" בשלב 1, שכבר פותחת את הרשאת הקול לכל הסדנה.
 */

const STORAGE_KEY = "fractal-tap-sound";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/** האם צלילי המגע דלוקים. ברירת המחדל: דלוקים. */
export function tapSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setTapSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // אחסון חסום - ההגדרה תקפה למפגש הנוכחי בלבד
  }
}

/**
 * טיק קצר ורך. `tone` מבדיל בין לחיצה רגילה לבין פעולה ראשית, כך
 * ש"המשך" נשמע קצת יותר "פתוח" מאשר כיבוי מתג.
 */
export function playTap(tone: "soft" | "primary" = "soft") {
  if (!tapSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  // הדפדפן משהה את ההקשר עד שהייתה מחוות משתמשת; זו בדיוק אחת כזו.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // תדר עולה קלות במקום נקודה אחת - זה מה שנותן לטיק "חיים"
    osc.frequency.setValueAtTime(tone === "primary" ? 520 : 760, now);
    osc.frequency.exponentialRampToValueAtTime(tone === "primary" ? 880 : 620, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone === "primary" ? 0.07 : 0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch {
    // בלי צליל - לא עוצרים שום זרימה בגללו
  }
}

/**
 * רטט קצר, איפה שהמכשיר תומך. על פלזמת אנדרואיד זה בדרך כלל לא יעשה
 * כלום, ועל טאבלט/טלפון זה מוסיף הרבה - ולכן זה נקרא בלי תנאי ובלי
 * להיכשל כשאין תמיכה.
 */
export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // חלק מהדפדפנים זורקים כשה-API חסום במדיניות
  }
}
