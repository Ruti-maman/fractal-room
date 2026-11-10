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

/* ==========================================================================
   ערוץ הצלילים הדרמטיים (בקשת הלקוחה, 2026-11-08: "יותר בקול ויותר דרמטי").

   כל צלילי המעבר והמצב יוצאים דרך **מדחס** ואחריו הגברה. המדחס הוא מה
   שמאפשר להגביר בלי עיוות: כשכמה צלילים נופלים יחד (בס + נצנוץ + הד),
   הסכום שלהם היה עובר את התקרה ונשבר לרעש צורם. בנוסף יש **הד** משותף
   שנותן לצלילים זנב, כמו באולם - זה מה שהופך צלצול לרגע דרמטי.
   ========================================================================== */

let bus: AudioNode | null = null;
let echoIn: AudioNode | null = null;

function getBus(ctx: AudioContext): AudioNode {
  if (bus) return bus;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 2.2;
  comp.connect(master).connect(ctx.destination);
  bus = comp;
  return comp;
}

/** הד: השהיה עם משוב, ומסנן שמעמעם כל חזרה - כמו אולם ולא כמו מתכת. */
function getEcho(ctx: AudioContext): AudioNode {
  if (echoIn) return echoIn;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.21;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2600;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  delay.connect(damp).connect(feedback).connect(delay);
  damp.connect(wet).connect(getBus(ctx));
  echoIn = delay;
  return delay;
}

/** שולח צומת לערוץ הראשי, ואם צריך גם להד. */
function send(ctx: AudioContext, node: AudioNode, echo = false) {
  node.connect(getBus(ctx));
  if (echo) node.connect(getEcho(ctx));
}

function readyContext(): AudioContext | null {
  if (!tapSoundEnabled()) return null;
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** צליל אחד: מתנד עם מעטפת קצרה. עזר לכל הצלילים שלמטה. */
function tone(
  ctx: AudioContext,
  at: number,
  freq: number,
  dur: number,
  volume: number,
  type: OscillatorType = "triangle",
  slideTo?: number,
  echo = false,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur * 0.8);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  send(ctx, gain, echo);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** "בום" - תוף עמוק: סינוס שצונח בתדר. זה מה שנותן לרגע משקל. */
function boom(ctx: AudioContext, at: number, volume = 0.7, from = 150, to = 42, dur = 0.9) {
  tone(ctx, at, from, dur, volume, "sine", to);
}

/** רעש לבן דרך מסנן נע - בסיס להתנפצות, ל-whoosh ולמשיכה מעלה. */
function noise(
  ctx: AudioContext,
  at: number,
  seconds: number,
  volume: number,
  filterType: BiquadFilterType,
  fFrom: number,
  fTo: number,
  rampIn = 0.01,
  echo = false,
) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(fFrom, at);
  filter.frequency.exponentialRampToValueAtTime(fTo, at + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + rampIn);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(filter).connect(gain);
  send(ctx, gain, echo);
  src.start(at);
  src.stop(at + seconds);
}

/**
 * ה-whoosh של מעבר שלב: רעש לבן קצר שעובר דרך מסנן נע, מלמעלה למטה.
 * זה בדיוק מה שמשחקים עושים כדי שמעבר בין מסכים יישמע כמו תנועה ולא
 * כמו קליק - והאוזן תופסת את זה גם כשהעין עסוקה בלהבים.
 *
 * `impact` מוסיף בסוף "נחיתה" עמוקה - המעבר נשמע כמו משהו שנוחת במקום.
 */
export function playWhoosh(volume = 0.1, impact = false) {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    noise(ctx, now, impact ? 0.6 : 0.5, volume, "bandpass", 2400, 260, 0.07);
    if (impact) boom(ctx, now + 0.32, volume * 1.2, 130, 45, 0.6);
  } catch {
    // בלי צליל - לא עוצרים שום זרימה בגללו
  }
}

/**
 * "פופ" של חלונית שקופצת (טיפים, משתתפת חדשה) - שני צלילים עולים כמו
 * בועה שנפתחת, עם "תום" קטן מתחת שנותן להם גוף.
 */
export function playPop(volume = 0.09) {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    tone(ctx, now, 520, 0.16, volume, "triangle", 780);
    tone(ctx, now + 0.09, 780, 0.2, volume, "triangle", 1170, true);
    tone(ctx, now, 180, 0.18, volume * 0.9, "sine", 90);
  } catch {
    // בלי צליל - לא עוצרים שום זרימה בגללו
  }
}

/* ==========================================================================
   צלילי מעבר ומצב - בולטים ודרמטיים (בקשת הלקוחה, 2026-11-08). כולם
   נוצרים כאן ב-Web Audio (בלי קבצים ובלי דומיין), וכולם נשמעים לפי
   מתג "צלילי מגע".
   ========================================================================== */

/**
 * הלוגו מתפזר לריבועים: **פיצוץ** - בום עמוק,
 * התנפצות זכוכית, וגשם של צלצולים שיורדים ומהדהדים.
 */
export function playShatter() {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // הפיצוץ
    boom(ctx, now, 0.9, 160, 38, 1.3);
    noise(ctx, now, 0.6, 0.55, "highpass", 5200, 1800, 0.004, true);
    // הריבועים "מצלצלים" כשהם עפים - תווים גבוהים שיורדים, עם הד
    [2637, 2093, 1760, 1568, 1319, 1175, 988, 784].forEach((f, i) =>
      tone(ctx, now + 0.06 + i * 0.065, f, 0.5, 0.2, "sine", undefined, true),
    );
  } catch {
    // בלי צליל - לא עוצרים שום זרימה בגללו
  }
}

/** צלצול ברור ומהדהד - משהו הופיע (שם הקבוצה בסיכום). */
export function playChime() {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    boom(ctx, now, 0.45, 110, 55, 0.7);
    tone(ctx, now, 1047, 0.9, 0.3, "sine", undefined, true);
    tone(ctx, now + 0.1, 1568, 1.0, 0.24, "sine", undefined, true);
    tone(ctx, now + 0.2, 2093, 1.1, 0.16, "sine", undefined, true);
  } catch {
    // בלי צליל
  }
}

/**
 * תרועת הצלחה - "הקבוצה נוצרה בהצלחה": ארבעה תווים עולים, ואז אקורד
 * מלא ומחזיק עם תוף עמוק, כמו סיום שלב במשחק.
 */
export function playSuccess() {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, now + i * 0.12, f, 0.28, 0.3, "triangle");
      tone(ctx, now + i * 0.12, f * 2, 0.22, 0.08, "sine");
    });
    const hit = now + 0.36;
    boom(ctx, hit, 0.85, 140, 40, 1.2);
    noise(ctx, hit, 0.9, 0.2, "highpass", 6000, 3000, 0.005, true); // מצילה
    // האקורד הגדול: דו מז'ור בשלוש אוקטבות, ארוך ומהדהד
    [262, 523, 659, 784, 1047].forEach((f) => tone(ctx, hit, f, 1.6, 0.17, "triangle", undefined, true));
  } catch {
    // בלי צליל
  }
}

/**
 * נצנוץ קסום - "כלל הפרקטל" נבנה על המסך: משיכה של רעש שעולה, ואז
 * מפל של תווים גבוהים עם הד, מעל צליל בס שמתנפח.
 */
export function playSparkle() {
  const ctx = readyContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // המשיכה למעלה (riser)
    noise(ctx, now, 1.1, 0.22, "bandpass", 300, 5000, 0.9);
    // הבס שמתנפח מתחת
    tone(ctx, now, 131, 2.2, 0.3, "sine");
    tone(ctx, now, 196, 2.2, 0.16, "sine");
    // מפל התווים
    const top = now + 0.85;
    boom(ctx, top, 0.6, 120, 45, 1.0);
    [1319, 1568, 1760, 2093, 2349, 2637, 3136, 3520].forEach((f, i) =>
      tone(ctx, top + i * 0.075, f, 0.7, 0.16, "sine", undefined, true),
    );
  } catch {
    // בלי צליל
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
