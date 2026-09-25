/**
 * "פתיחת" הרשאת הקול לכל הסדנה.
 *
 * הרקע: דפדפנים חוסמים ניגון עם קול עד שהייתה נגיעה/לחיצה אמיתית בדף
 * (autoplay policy). בסדנה אין מי שילחץ "נגן" על כל סרטון, ולכן הנגיעה
 * הראשונה - הכפתור "התחילו" בשלב 1 - משמשת לפתיחת ההרשאה לכל שאר הסדנה
 * (ראו סעיף 2 ב-CLAUDE.md: "השמעת קול מחייבת נגיעה במסך").
 *
 * מה קורה כאן בפועל: מפעילים AudioContext ומנגנים בופר שקט לרגע. מרגע זה
 * הדפדפן מסמן שהדף "קיבל אישור", וקריאות play() מאוחרות יותר - גם על
 * סרטונים עם קול - מצליחות בלי לחיצה נוספת.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function silentPing() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    // בופר של פריים אחד, בעוצמה אפס - לא נשמע, אבל מספיק כדי "לשחרר" את הדפדפן
    const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    // דפדפן ישן בלי AudioContext - ננסה בכל זאת לנגן סרטונים; אם ייחסם,
    // AutoPlayVideo ינגן מושתק וינסה שוב בנגיעה הבאה.
  }
}

/** נקראת מתוך אירוע נגיעה אמיתי (הכפתור "התחילו"). */
export function primeAudio() {
  silentPing();
}

export function isAudioUnlocked() {
  return unlocked;
}

/**
 * רשת ביטחון: גם אם משום מה לא עברו דרך "התחילו" (רענון באמצע הסדנה,
 * פתיחת מסך ישירות בשלב מאוחר), הנגיעה הבאה על המסך תפתח את הקול.
 */
export function installAudioUnlock() {
  const handler = () => {
    silentPing();
    if (unlocked) {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", handler);
    }
  };
  document.addEventListener("pointerdown", handler);
  document.addEventListener("touchstart", handler);
  document.addEventListener("keydown", handler);
}
