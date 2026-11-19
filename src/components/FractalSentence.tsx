/*
 * ============================================================================
 *  משפט פרקטלי - "חלק קטן, אבל כבר רואים בו את השלם"
 * ============================================================================
 *
 *  לפי סרטון ה-g של הלקוחה (D:\סמינר ויזניץ, הסרטון הראשון). מה שקורה שם,
 *  ומה שנבנה כאן בהתאם (כתיבה מחדש 2026-11-11, אחרי שגרסת "ספירלת החמנייה"
 *  נפסלה - היא יצרה זרועות סדורות שנראו כמו פרופלר):
 *
 *   1. **שדה אותיות מפוזר טבעי** על כל המסך: רשת עם רעד גדול בכל תא - אין
 *      שורות, אין זרועות, אין דוגמה. כל אות מכוונת לאורך הזרם.
 *   2. **מערבולת רכה**: השדה מסתובב סביב המרכז, מהר יותר קרוב אליו.
 *   3. **המשפט מתגבש מתוך הבלגן**: אותיות המשפט יוצאות מהשדה **ומסתחררות
 *      פנימה עם הזרם** (מסלול קוטבי, תמיד באותו כיוון סיבוב) אל מקומן.
 *      ההתגבשות מתחילה מהמרכז ומתפשטת החוצה - כמו ה-G שצומחת בסרטון.
 *   4. **סוף ברור**: המשפט בצבע אחד (הקורל של הכותרות), אותיות זקופות
 *      וצפופות, צל מלא עדין מתחתן, והשדה נפתח סביבו ("הילה" ריקה).
 *
 *  ----------------------------------------------------------------------
 *  ביצועים - נמדד, לא תיאורטי
 *  ----------------------------------------------------------------------
 *  ציור של כל אות בכל פריים (כ-6,000 קריאות) נמדד 58ms לפריים גם עם כרטיס
 *  מסך - פחות מ-10 פריימים בשנייה. לכן:
 *   - **השדה מצויר פעם אחת** לשלוש טבעות קונצנטריות, ובכל פריים מסובבים
 *     רק את שלוש התמונות, כל אחת בקצב שלה (המרכז מהר יותר). שלושה ציורים
 *     במקום אלפים, והמערבולת נשמרת.
 *   - **ההילה** נמחקת מהשדה בפעולה אחת (destination-out) מתמונה מוכנה.
 *   - **רק אותיות בדרך** מצוירות אחת-אחת, ורק בזמן ההתגבשות; כל אות היא
 *     ספרייט מוכן (drawImage) ולא fillText. המשפט הבנוי שמור כתמונה אחת.
 *  נמדד אחרי השינויים (1920x1080, כרטיס מסך): 55-60 פריימים בשנייה בכל
 *  השלבים. בלי כרטיס מסך כלל - איטי מאוד, ולכן "אפקטים מופחתים" ב-/admin
 *  ו-prefers-reduced-motion מציגים את המשפט בנוי, בלי תנועה. הטקסט המלא קיים
 *  גם לקוראי מסך.
 */

import { useEffect, useRef } from "react";

const TEXT_SPACING = 3;

/* --- מצב "פעם אחת" (מסך מלא): שדה זורם, התגבשות, החזקה - ואז onDone --- */
const ONCE_SWIRL_MS = 1800;
const ONCE_BUILD_MS = 3000;
const ONCE_HOLD_MS = 4000;
/* חזרות (repeats > 1): בין בנייה לבנייה המשפט מחזיק, מתפרק חזרה לשדה, ונבנה שוב */
const REPEAT_HOLD_MS = 1800;
const REPEAT_BREAK_MS = 1800;
const REPEAT_CYCLE_MS = ONCE_BUILD_MS + REPEAT_HOLD_MS + REPEAT_BREAK_MS;

/* --- מצב לופ (בלי once) --- */
const CYCLE_MS = 11000;

/** מספר הטבעות שהשדה מחולק אליהן לסיבוב דיפרנציאלי */
const RINGS = 3;
/**
 * השדה - אותיות אפורות שמסתובבות על כל המסך מאחורי המשפט. כבוי לבקשת
 * המפתחת (2026-11-12, "תוריד את האותיות האפורות"): נשארות רק האותיות
 * האדומות שעפות ונבנות למשפט. true מחזיר את השדה כמו שהיה.
 */
const SHOW_FIELD = false;
/** חלק מזמן הבנייה שבו מתפזרות נקודות ההתחלה (מרכז -> קצוות) */
const SPREAD = 0.5;

/** 0..1 החלקה רכה בשני הקצוות (smootherstep) */
const smooth = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function loopAmount(t: number) {
  const p = (t % CYCLE_MS) / CYCLE_MS;
  if (p < 0.18) return 0;
  if (p < 0.45) return (p - 0.18) / 0.27;
  if (p < 0.75) return 1;
  if (p < 0.95) return 1 - (p - 0.75) / 0.2;
  return 0;
}

function onceAmount(elapsed: number, repeats: number) {
  if (elapsed < ONCE_SWIRL_MS) return 0;
  let e = elapsed - ONCE_SWIRL_MS;
  for (let i = 0; i < repeats; i++) {
    if (e < ONCE_BUILD_MS) return e / ONCE_BUILD_MS;
    e -= ONCE_BUILD_MS;
    if (i === repeats - 1) return 1;
    if (e < REPEAT_HOLD_MS) return 1;
    e -= REPEAT_HOLD_MS;
    if (e < REPEAT_BREAK_MS) return 1 - e / REPEAT_BREAK_MS;
    e -= REPEAT_BREAK_MS;
  }
  return 1;
}

/** משך כל המופע במצב once, עד onDone. */
function onceTotalMs(repeats: number) {
  return ONCE_SWIRL_MS + repeats * ONCE_BUILD_MS + (repeats - 1) * (REPEAT_HOLD_MS + REPEAT_BREAK_MS) + ONCE_HOLD_MS;
}

/** צבע CSS כלשהו -> [r,g,b], דרך הקנבס עצמו (הוא מנרמל כל תחביר) */
function toRgb(ctx: CanvasRenderingContext2D, color: string, fallback: [number, number, number]) {
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  const v = String(ctx.fillStyle);
  if (v.startsWith("#") && v.length === 7) {
    return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)] as [number, number, number];
  }
  const m = v.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? ([+m[0], +m[1], +m[2]] as [number, number, number]) : fallback;
}

function makeCanvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  return c;
}

interface Ring {
  canvas: HTMLCanvasElement;
  omega: number; // רדיאנים לשנייה
}

interface SentenceLetter {
  r: number; // בית בשדה (קוטבי)
  a: number;
  omega: number;
  ch: string;
  tx: number; // המקום במשפט
  ty: number;
  tr: number; // אותו מקום בקוטבי
  ta: number;
  delay: number; // 0 = במרכז (מתגבשת ראשונה), 1 = בקצה
}

interface Props {
  text: string;
  className?: string;
  /** מאגר האותיות הקטנות. בלעדיו - האותיות של המשפט עצמו. */
  letters?: string;
  /**
   * האם בסוף הבנייה נחשף המשפט בכתב מלא ואטום מעל האותיות הקטנות. במסך המלא
   * לא (לבקשת הלקוחה: "ולא יהיו צבע מלא") - רק צל מלא עדין מתחתן.
   */
  solid?: boolean;
  /** מרווח הרשת של האותיות שבונות את המשפט, בפיקסלים. */
  grain?: number;
  /** בונה את המשפט פעם אחת (בלי לופ), מחזיק אותו, וקורא ל-onDone. */
  once?: boolean;
  /** במצב once: כמה פעמים המשפט נבנה (מתפרק ונבנה שוב בין לבין). */
  repeats?: number;
  onDone?: () => void;
  /** נקרא בתחילת כל בנייה (0, 1, 2...) - למשל לצליל. */
  onBuildStart?: (index: number) => void;
  /** צבע המשפט. בלעדיו - הקורל של הכותרות (--ds-pal-3). לבן על הכחול
   *  של שפת "עיתונאי" (2026-11-12). */
  color?: string;
}

function FractalSentence({
  text,
  className,
  letters: letterPool,
  solid = true,
  grain = TEXT_SPACING,
  once = false,
  repeats = 1,
  onDone,
  onBuildStart,
  color,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ref ולא תלות באפקט - פונקציה חדשה בכל רינדור של ההורה לא תאתחל את האנימציה
  const onDoneRef = useRef(onDone);
  const onBuildStartRef = useRef(onBuildStart);
  useEffect(() => {
    onDoneRef.current = onDone;
    onBuildStartRef.current = onBuildStart;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // בלי תנועה: גם מי שביקשה פחות תנועה, וגם "אפקטים מופחתים" ב-/admin -
    // ברז הביטחון של הפרויקט אם המסך בחדר מגמגם (סעיף 3 ב-CLAUDE.md).
    // בלי כרטיס מסך האנימציה הזו נמדדה איטית מאוד; כאן המשפט פשוט מופיע בנוי.
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-effects") === "lite";
    const pool = letterPool || text.replace(/[^֐-׿]/g, "") || "פרקטל";
    const reps = Math.max(1, repeats);
    const totalMs = onceTotalMs(reps);

    // גדלים: אות שדה גדולה ודלילה (כמו ה-g בחוץ בסרטון), אות משפט קטנה וצפופה
    const fieldStep = Math.max(14, grain * 6);
    const fieldSize = fieldStep * 0.55;
    const formedSize = grain * 1.75;

    // צבעים מהטוקנים: השדה בצבע הטקסט, המשפט בקורל של הכותרות
    const css = getComputedStyle(document.documentElement);
    const inkRgb = toRgb(ctx, css.getPropertyValue("--ds-text").trim() || "#f2f2ff", [242, 242, 255]);
    const coralRgb = toRgb(ctx, color || css.getPropertyValue("--ds-pal-3").trim() || "#f26a50", [242, 106, 80]);
    const coralCss = `rgb(${coralRgb.join(",")})`;
    const STEPS = 12;
    const ramp = Array.from({ length: STEPS + 1 }, (_, i) => {
      const k = i / STEPS;
      const c = inkRgb.map((v, j) => Math.round(v + (coralRgb[j] - v) * k));
      return `rgb(${c.join(",")})`;
    });

    // ספרייטים: כל אות פעם אחת כתמונה קטנה, בכל אחד מ-13 הגוונים
    const dpr0 = Math.max(1, window.devicePixelRatio || 1);
    const spriteCss = fieldSize * 1.6;
    const half = spriteCss / 2;
    const spritePx = Math.ceil(spriteCss * dpr0);
    const sprites = new Map<string, HTMLCanvasElement[]>();
    for (const ch of new Set(pool.split(""))) {
      sprites.set(
        ch,
        ramp.map((color) => {
          const c = makeCanvas(spritePx, spritePx);
          const g = c.getContext("2d")!;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.font = `800 ${spritePx / 1.6}px Heebo, Assistant, sans-serif`;
          g.fillStyle = color;
          g.fillText(ch, spritePx / 2, spritePx / 2);
          return c;
        }),
      );
    }

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let fieldR = 1;
    let rings: Ring[] = [];
    let sentence: SentenceLetter[] = [];
    let haloCanvas: HTMLCanvasElement | null = null;
    let formedCanvas: HTMLCanvasElement | null = null;
    let settledCanvas: HTMLCanvasElement | null = null;
    let settled = new Uint8Array(0);
    let settledCount = 0;
    let lastForm = 0;
    let formedTop = 0;
    let fontSpec = "";
    let textY = 0;
    let start = 0;
    let frame = 0;
    let cancelled = false;
    let fontsReady = false;
    let doneFired = false;
    let doneTimer = 0;
    let buildsFired = 0;

    /** מהירות הסיבוב: רכה, מהר יותר ליד המרכז. רדיאנים לשנייה. */
    const omegaAt = (r: number) => 0.08 + 0.15 * Math.exp(-((r / (fieldR * 0.45)) ** 2));

    function build() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      // עוד לא נפרס (שכבה שנכנסת באנימציה) - ה-ResizeObserver יבנה שוב
      if (w < 2 || h < 2) return;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      cx = w / 2;
      cy = h / 2;
      textY = h * 0.52;
      fieldR = Math.hypot(cx, cy) + fieldStep;

      // --- מסכת המשפט: שורה אחת (בקשת הלקוחה), בגודל המרבי שנכנס ברוחב ---
      const mask = makeCanvas(w, h);
      // willReadFrequently: המסכה נקראת ב-getImageData, ובזיכרון רגיל זה מהיר
      // פי כמה מקריאה חזרה מכרטיס המסך
      const m = mask.getContext("2d", { willReadFrequently: true })!;
      m.direction = "rtl";
      m.textAlign = "center";
      m.textBaseline = "middle";
      let size = h * 0.42;
      m.font = `800 ${size}px Heebo, Assistant, sans-serif`;
      while (m.measureText(text).width > w * 0.92 && size > 12) {
        size -= 1;
        m.font = `800 ${size}px Heebo, Assistant, sans-serif`;
      }
      fontSpec = m.font;
      m.fillStyle = "#000";
      m.strokeStyle = "#000";
      m.lineJoin = "round";
      m.lineWidth = Math.max(1, size * 0.05); // עיבוי קל: מקום לכמה אותיות בכל קו
      m.fillText(text, cx, textY);
      m.strokeText(text, cx, textY);
      const data = m.getImageData(0, 0, mask.width, mask.height).data;
      const inked = (x: number, y: number) => data[(Math.round(y) * mask.width + Math.round(x)) * 4 + 3] > 128;

      // --- הילה: המשפט עם קו עבה ושוליים רכים. נמחקת מהשדה כשהמשפט נבנה ---
      haloCanvas = makeCanvas(w * dpr, h * dpr);
      const hc = haloCanvas.getContext("2d")!;
      hc.scale(dpr, dpr);
      hc.direction = "rtl";
      hc.textAlign = "center";
      hc.textBaseline = "middle";
      hc.font = fontSpec;
      hc.fillStyle = "#000";
      hc.strokeStyle = "#000";
      hc.lineJoin = "round";
      hc.lineWidth = size * 0.05 + fieldStep * 1.6;
      hc.shadowColor = "#000";
      hc.shadowBlur = fieldStep * 0.9;
      hc.fillText(text, cx, textY);
      hc.strokeText(text, cx, textY);

      let seed = 11;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const pick = () => pool[Math.floor(rand() * pool.length)];

      // --- השדה: רשת עם רעד גדול בכל תא, מצוירת פעם אחת לטבעות ---
      const ringRes = Math.min(dpr, 1.5); // רזולוציה מוגבלת - חוסך זיכרון בפלזמה
      const nextRings: Ring[] = [];
      const ringCtx: CanvasRenderingContext2D[] = [];
      for (let k = 0; k < (SHOW_FIELD ? RINGS : 0); k++) {
        const rOut = (fieldR * (k + 1)) / RINGS;
        const D = 2 * (rOut + spriteCss) * ringRes;
        const c = makeCanvas(D, D);
        const g = c.getContext("2d")!;
        g.setTransform(ringRes, 0, 0, ringRes, c.width / 2, c.height / 2);
        ringCtx.push(g);
        nextRings.push({ canvas: c, omega: omegaAt((fieldR * (k + 0.5)) / RINGS) });
      }
      for (let gy = -fieldR; SHOW_FIELD && gy < fieldR; gy += fieldStep) {
        for (let gx = -fieldR; gx < fieldR; gx += fieldStep) {
          const x = gx + rand() * fieldStep;
          const y = gy + rand() * fieldStep;
          const r = Math.hypot(x, y);
          if (r > fieldR) continue;
          const ch = pick();
          const k = Math.min(RINGS - 1, Math.floor((r / fieldR) * RINGS));
          const g = ringCtx[k];
          const rot = Math.atan2(y, x) + Math.PI / 2; // לאורך הזרם
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          g.drawImage(sprites.get(ch)![0], -half, -half, spriteCss, spriteCss);
          g.restore();
        }
      }
      rings = nextRings;

      // --- המשפט: אותיות צפופות על רשת בתוך הצורה ---
      const nextSentence: SentenceLetter[] = [];
      const halfW = Math.max(1, w * 0.46);
      let minY = h;
      let maxY = 0;
      for (let y = 0; y < h; y += grain) {
        for (let x = 0; x < w; x += grain) {
          const jx = x + (rand() - 0.5) * grain * 0.12;
          const jy = y + (rand() - 0.5) * grain * 0.12;
          if (jx < 0 || jy < 0 || jx >= w || jy >= h || !inked(jx, jy)) continue;
          // הבית בשדה: נקודה אקראית על המסך, ממנה האות "נשלפת"
          const hx = (rand() * 2 - 1) * Math.min(cx * 1.05, fieldR);
          const hy = (rand() * 2 - 1) * Math.min(cy * 1.05, fieldR);
          const r = Math.hypot(hx, hy);
          const dx = jx - cx;
          const dy = jy - cy;
          minY = Math.min(minY, jy);
          maxY = Math.max(maxY, jy);
          nextSentence.push({
            r,
            a: Math.atan2(hy, hx),
            omega: omegaAt(r),
            ch: pick(),
            tx: jx,
            ty: jy,
            tr: Math.hypot(dx, dy),
            ta: Math.atan2(dy, dx),
            // מהמרכז החוצה, עם קצת אקראיות כדי שהחזית לא תהיה קו ישר
            delay: clamp01((Math.abs(dx) / halfW) * 0.85 + rand() * 0.15),
          });
        }
      }
      sentence = nextSentence;

      // --- המשפט הבנוי כתמונה אחת (רק הרצועה שלו, לא כל המסך) ---
      const pad = formedSize * 2;
      formedTop = Math.max(0, minY - pad);
      const bandH = Math.min(h, maxY + pad) - formedTop;
      formedCanvas = makeCanvas(w * dpr, Math.max(1, bandH) * dpr);
      const fc = formedCanvas.getContext("2d")!;
      for (const p of sentence) stamp(fc, p, dpr);

      // רצועה ריקה באותו גודל: כל אות שנוחתת "מוחתמת" עליה ולא מצוירת שוב
      settledCanvas = makeCanvas(formedCanvas.width, formedCanvas.height);
      settled = new Uint8Array(sentence.length);
      settledCount = 0;
    }

    /** מצייר אות בנויה (זקופה, בגודל הסופי, בקורל) על רצועת המשפט */
    function stamp(g: CanvasRenderingContext2D, p: SentenceLetter, dpr: number) {
      const scale = formedSize / fieldSize;
      g.setTransform(scale * dpr, 0, 0, scale * dpr, p.tx * dpr, (p.ty - formedTop) * dpr);
      g.drawImage(sprites.get(p.ch)![STEPS], -half, -half, spriteCss, spriteCss);
    }

    function draw(now: number) {
      const dpr = window.devicePixelRatio || 1;
      if (!start) start = now;
      const elapsed = now - start;
      const form = reduced ? 1 : once ? onceAmount(elapsed, reps) : loopAmount(now);
      const t = reduced ? 0 : now / 1000;

      if (once && !reduced && buildsFired < reps && elapsed >= ONCE_SWIRL_MS + buildsFired * REPEAT_CYCLE_MS) {
        onBuildStartRef.current?.(buildsFired);
        buildsFired++;
      }
      if (once && !doneFired && elapsed > totalMs) {
        doneFired = true;
        onDoneRef.current?.();
      }
      if (!haloCanvas || !formedCanvas || !settledCanvas) {
        if (!reduced && !cancelled) frame = requestAnimationFrame(draw);
        return;
      }

      // --- השדה: שלוש טבעות מסתובבות ישר על הקנבס (אין עליו עוד כלום בשלב
      // הזה, אז אפשר למחוק את ההילה ישר ממנו - בלי שכבת ביניים) ---
      const fieldAlpha = 0.34 - form * 0.12;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalCompositeOperation = "source-over";
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.globalAlpha = fieldAlpha;
      const ringRes = Math.min(dpr, 1.5);
      const k = dpr / ringRes;
      for (const ring of SHOW_FIELD ? rings : []) {
        const ang = t * ring.omega;
        const c = Math.cos(ang) * k;
        const s = Math.sin(ang) * k;
        ctx!.setTransform(c, s, -s, c, cx * dpr, cy * dpr);
        ctx!.drawImage(ring.canvas, -ring.canvas.width / 2, -ring.canvas.height / 2);
      }
      if (form > 0) {
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.globalCompositeOperation = "destination-out";
        ctx!.globalAlpha = smooth(form) * 0.97;
        ctx!.drawImage(haloCanvas, 0, 0);
        ctx!.globalCompositeOperation = "source-over";
      }

      // המשפט מתפרק (חזרות/לופ) - האותיות שנחתו חוזרות לזוז
      if (form < lastForm && settledCount > 0) {
        settledCanvas.getContext("2d")!.clearRect(0, 0, settledCanvas.width, settledCanvas.height);
        settled.fill(0);
        settledCount = 0;
      }
      lastForm = form;

      // --- צל מלא עדין של המשפט מתחת לאותיות: הצורה נקראת מרחוק ---
      const ready = clamp01((form - 0.82) / 0.18);
      if (ready > 0) {
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.font = fontSpec;
        ctx!.direction = "rtl";
        ctx!.globalAlpha = ready * (solid ? 1 : 0.3);
        ctx!.fillStyle = coralCss;
        ctx!.fillText(text, cx, textY);
        ctx!.direction = "ltr";
      }

      // --- המשפט ---
      if (form >= 1) {
        // בנוי: תמונה אחת
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.globalAlpha = 1;
        ctx!.drawImage(formedCanvas, 0, Math.round(formedTop * dpr));
      } else if (form > 0) {
        const formedScale = formedSize / fieldSize;
        const sg = settledCanvas.getContext("2d")!;
        for (let i = 0; i < sentence.length; i++) {
          if (settled[i]) continue; // כבר נחתה - מצוירת ברצועה למטה
          const p = sentence[i];
          const local = smooth(clamp01((form - p.delay * SPREAD) / (1 - SPREAD)));
          if (local <= 0) continue; // עוד בשדה - מצוירת שם כחלק מהבלגן
          if (local >= 1 && form >= lastForm) {
            stamp(sg, p, dpr);
            settled[i] = 1;
            settledCount++;
            continue;
          }
          const th = p.a + t * p.omega;
          let x: number;
          let y: number;
          let rot: number;
          if (local >= 1) {
            x = p.tx;
            y = p.ty;
            rot = 0;
          } else {
            // מסתחררת פנימה עם הזרם: מסלול קוטבי, תמיד קדימה בכיוון הסיבוב
            let dA = (p.ta - th) % (Math.PI * 2);
            if (dA < 0) dA += Math.PI * 2;
            const ang = th + dA * local;
            const rad = p.r + (p.tr - p.r) * local;
            x = cx + Math.cos(ang) * rad;
            y = cy + Math.sin(ang) * rad;
            // מתיישרת: מכיוון הזרם אל זקוף
            let fromRot = (th + Math.PI / 2) % (Math.PI * 2);
            if (fromRot > Math.PI) fromRot -= Math.PI * 2;
            if (fromRot < -Math.PI) fromRot += Math.PI * 2;
            rot = fromRot * (1 - local);
          }
          if (x < -spriteCss || y < -spriteCss || x > w + spriteCss || y > h + spriteCss) continue;
          // נדלקת מתוך השדה בהדרגה, לא קופצת
          ctx!.globalAlpha = (fieldAlpha + (1 - fieldAlpha) * local) * Math.min(1, local * 6);
          const sc = (1 + (formedScale - 1) * local) * dpr;
          const c = Math.cos(rot) * sc;
          const s = Math.sin(rot) * sc;
          ctx!.setTransform(c, s, -s, c, x * dpr, y * dpr);
          // בלי השדה האפור - כל אות באדום מלא כבר מתחילת המעוף
          ctx!.drawImage(
            sprites.get(p.ch)![SHOW_FIELD ? Math.round(local * STEPS) : STEPS],
            -half,
            -half,
            spriteCss,
            spriteCss,
          );
        }
        if (settledCount > 0) {
          ctx!.setTransform(1, 0, 0, 1, 0, 0);
          ctx!.globalAlpha = 1;
          ctx!.drawImage(settledCanvas, 0, Math.round(formedTop * dpr));
        }
      }
      ctx!.globalAlpha = 1;

      if (!reduced && !cancelled) frame = requestAnimationFrame(draw);
    }

    // מחכים לפונט (Heebo ארוז מקומית) כדי שהמסכה והספרייטים ייבנו נכון.
    // הספרייטים נבנו כבר למעלה; אם הפונט עוד לא היה מוכן - בונים אותם מחדש.
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      for (const [ch, list] of sprites) {
        list.forEach((c, i) => {
          const g = c.getContext("2d")!;
          g.clearRect(0, 0, c.width, c.height);
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.font = `800 ${spritePx / 1.6}px Heebo, Assistant, sans-serif`;
          g.fillStyle = ramp[i];
          g.fillText(ch, spritePx / 2, spritePx / 2);
        });
      }
      fontsReady = true;
      build();
      frame = requestAnimationFrame(draw);
      // בלי תנועה אין פריימים שימדדו את הזמן - מסיימים לפי שעון רגיל
      if (once && reduced) {
        doneTimer = window.setTimeout(() => onDoneRef.current?.(), ONCE_HOLD_MS + 1000);
      }
    });

    const ro = new ResizeObserver(() => {
      if (!fontsReady) return;
      build();
      if (reduced) frame = requestAnimationFrame(draw);
    });
    ro.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(doneTimer);
      ro.disconnect();
    };
  }, [text, letterPool, solid, grain, once, repeats, color]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
      <span className="sr-only">{text}</span>
    </div>
  );
}

export default FractalSentence;
