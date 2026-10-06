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
 * ה-whoosh של מעבר שלב: רעש לבן קצר שעובר דרך מסנן נע, מלמעלה למטה.
 * זה בדיוק מה שמשחקים עושים כדי שמעבר בין מסכים יישמע כמו תנועה ולא
 * כמו קליק - והאוזן תופסת את זה גם כשהעין עסוקה בלהבים.
 */
export function playWhoosh() {
  if (!tapSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  try {
    const now = ctx.currentTime;
    const seconds = 0.5;

    // רעש לבן נוצר כאן ולא נטען מקובץ - אין CDN, ואין טעם לארוז קובץ
    // שמע ל-build בשביל חצי שנייה של רעש.
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + seconds);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + seconds);
  } catch {
    // בלי צליל - לא עוצרים שום זרימה בגללו
  }
}

/**
 * הצליל של הדקה האחרונה - לבקשת הלקוחה: חזק ומלחיץ.
 * כל שנייה: "דופק" נמוך (כמו לב פועם) + תקתוק חד מעליו. ב-10 השניות
 * האחרונות מתווסף ביפ אזעקה כפול שעולה בגובה ככל שמתקרבים לאפס.
 * `secondsLeft` קובע את העוצמה והגובה - הלחץ גדל עם הזמן.
 */
export function playClockTick({ secondsLeft = 60 } = {}) {
  if (!tapSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // 0 בתחילת הדקה, 1 בסופה
  const urgency = Math.min(1, Math.max(0, (60 - secondsLeft) / 60));

  const tone = (
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    volume: number,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  };

  try {
    const now = ctx.currentTime;
    // דופק כפול (לאב-דאב) - נמוך ועמוק
    tone("sine", 95, 50, now, 0.14, 0.45 + urgency * 0.25);
    tone("sine", 85, 45, now + 0.18, 0.12, 0.3 + urgency * 0.2);
    // תקתוק חד
    tone("square", 1800, 900, now, 0.035, 0.12 + urgency * 0.1);

    if (secondsLeft <= 10) {
      // אזעקה: שני ביפים, גבוהים יותר ככל שמתקרבים לאפס
      const pitch = 880 + (10 - secondsLeft) * 70;
      tone("sawtooth", pitch, pitch, now + 0.3, 0.12, 0.16);
      tone("sawtooth", pitch * 1.06, pitch * 1.06, now + 0.48, 0.12, 0.16);
    }
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
