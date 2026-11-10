/*
 * ============================================================================
 *  אפקטי טקסט - כדור, דיו
 * ============================================================================
 *
 *  לפי קובצי האפקטים שהלקוחה שלחה (effects-pack-3/5, new-effects), בהתאמה
 *  לפרויקט. המקומות (אושרו מול הלקוחה):
 *    כדור (SphereText)  - שלב 1, "ברוכות הבאות" נבנה מכדור אור מסתובב.
 *    דיו  (InkText)     - שלב 10, העיקרון שה-AI ניסח נספג לדף כמו דיו.
 *  (החול - SandText, בהכרזת המנצחת בשלב 9. אפקט ה"נוף" בשלב 8 הוסר לבקשת
 *  הלקוחה - המשפט שם מוצג כטקסט רגיל.)
 *
 *  עקרונות משותפים, כמו ב-FractalSentence ו-SandText:
 *   - Canvas דו-ממדי בלבד, בלי WebGL - הדפדפן בפלזמה לא ידוע ואולי ישן.
 *   - פונט Assistant הארוז בפרויקט, וצבעים מהטוקנים (קשת / צבע הטקסט), כך
 *     שזה עובד גם במצב הבהיר וגם בכהה.
 *   - **כל אפקט נגמר בטקסט חד וקריא** ועוצר את הציור - לא לולאה אינסופית
 *     (חוסך מעבד בפלזמה, ושום משפט לא נשאר "באמצע").
 *   - ב-prefers-reduced-motion הטקסט מוצג מוכן.
 *   - הטקסט המלא קיים גם לקוראי מסך (sr-only).
 */

import { useEffect, useRef } from "react";

/* ==========================================================================
   כלים משותפים
   ========================================================================== */

const FONT = (size: number) => `800 ${size}px Assistant, sans-serif`;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function readColors() {
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ds-text").trim() || "#121430";
  const rainbow = [1, 2, 3, 4, 5].map((n) => css.getPropertyValue(`--ds-rainbow-${n}`).trim() || ink);
  // צבע הכותרות - אדום הלוגו (ראו --ds-title-* ב-tokens.css)
  const title = css.getPropertyValue("--ds-title-to").trim() || ink;
  return { ink, rainbow, title };
}

interface TextMask {
  /** כיסוי הדיו בנקודה (0-1). */
  at: (x: number, y: number) => number;
  /** נקודות בתוך האותיות, בצפיפות step. */
  points: (step: number) => [number, number][];
  /** מצייר את הטקסט החד (לחשיפה בסוף). */
  paint: (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient) => void;
}

/**
 * מסכת טקסט בגודל הלוח. השורות נשברות לרוחב (משפט ארוך יורד שורה), והגופן
 * הוא הגדול ביותר שבו כל השורות נכנסות לגובה. כך גם משפט של 30 מילים נכנס
 * בשלמותו.
 */
function buildMask(text: string, w: number, h: number, opts: { blur?: number; maxLines?: number } = {}): TextMask {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const m = c.getContext("2d")!;
  m.direction = "rtl";
  m.textAlign = "center";
  m.textBaseline = "middle";

  const wrap = (size: number) => {
    m.font = FONT(size);
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (m.measureText(test).width > w * 0.94 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  // הגופן הגדול ביותר שבו כל השורות נכנסות
  let size = h * 0.78;
  let lines = wrap(size);
  const maxLines = opts.maxLines ?? 6;
  while (size > 10) {
    lines = wrap(size);
    const fitsH = lines.length * size * 1.25 <= h * 0.94;
    const fitsW = lines.every((l) => m.measureText(l).width <= w * 0.96);
    if (fitsH && fitsW && lines.length <= maxLines) break;
    size -= 1;
  }
  const lineH = size * 1.25;
  const top = h / 2 - ((lines.length - 1) * lineH) / 2;

  const draw = (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient) => {
    ctx.font = FONT(size);
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fill;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * lineH));
  };

  if (opts.blur) m.filter = `blur(${opts.blur}px)`;
  draw(m, "#000");
  const data = m.getImageData(0, 0, c.width, c.height).data;

  return {
    at: (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= c.width || yi >= c.height) return 0;
      return data[(yi * c.width + xi) * 4 + 3] / 255;
    },
    points: (step) => {
      const p: [number, number][] = [];
      for (let y = 0; y < c.height; y += step)
        for (let x = 0; x < c.width; x += step) if (data[(y * c.width + x) * 4 + 3] > 140) p.push([x, y]);
      return p;
    },
    paint: draw,
  };
}

/**
 * מסגרת משותפת לכל האפקטים: canvas בגודל האלמנט, המתנה לפונט, ציור בכל
 * פריים עד שהאפקט מחזיר "סיימתי", ובנייה מחדש בשינוי גודל (ישר למצב הסופי).
 */
function useCanvasEffect(
  text: string,
  setup: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    reduced: boolean,
  ) => (t: number, dt: number) => boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let cancelled = false;
    let step: ((t: number, dt: number) => boolean) | null = null;

    function start(skipToEnd: boolean) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) return;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      step = setup(ctx!, w, h, reduced || skipToEnd);
      let t0 = 0;
      let last = 0;
      cancelAnimationFrame(frame);
      const loop = (now: number) => {
        if (cancelled || !step) return;
        if (!t0) t0 = now;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
        last = now;
        const done = step((now - t0) / 1000, dt);
        if (!done) frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) start(false);
    });
    let built = false;
    const ro = new ResizeObserver(() => {
      if (!built) {
        built = true;
        return;
      }
      start(true);
    });
    ro.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
    // setup מוגדר בכל רינדור, אבל תלוי רק ב-text - בכוונה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return canvasRef;
}

function EffectBox({
  canvasRef,
  text,
  className,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      <span className="sr-only">{text}</span>
    </div>
  );
}

/* ==========================================================================
   כדור - כדור נקודות אור מסתובב שנפרש אל המילה
   ========================================================================== */

/** משך מחזור אחד בלופ: כדור, נבנה למילה, מחזיק, מתפרק בחזרה לכדור. */
const SPHERE_CYCLE = 9;

export function SphereText({
  text,
  className,
  loop = false,
}: {
  text: string;
  className?: string;
  /** חוזר על עצמו בלי סוף (שלב 1, לבקשת הלקוחה). בלי - נעצר על המילה. */
  loop?: boolean;
}) {
  const ref = useCanvasEffect(text, (ctx, w, h, reduced) => {
    // כותרת ("ברוכות הבאות", שלב 1) - אדום אחיד כמו כל הכותרות (בקשת
    // הלקוחה, 2026-11-08), ולא מעבר צבעים
    const { title } = readColors();
    const mask = buildMask(text, w, h, { maxLines: 1 });
    const pts = mask.points(3);
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const N = Math.max(300, Math.min(2200, pts.length));
    const golden = Math.PI * (3 - Math.sqrt(5));
    const sphere = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      return [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r] as const;
    });
    const target = sphere.map((_, i) => pts[i % Math.max(1, pts.length)] ?? [w / 2, h / 2]);
    const delay = sphere.map(() => Math.random() * 0.35);
    const R = Math.min(w, h) * 0.42;
    const focal = Math.min(w, h) * 2;

    return (t) => {
      // בלופ: הזמן בתוך המחזור. הסיבוב עצמו ממשיך ברצף (t), כדי שלא יקפוץ
      const time = reduced ? 9 : loop ? t % SPHERE_CYCLE : t;
      // התפרקות בחזרה לכדור בסוף כל מחזור (רק בלופ)
      const back = loop && !reduced ? ease(clamp01((time - 6.3) / 1.4)) : 0;
      ctx.clearRect(0, 0, w, h);
      const ry = (loop ? t : time) * 0.9;
      const rx = Math.sin(time * 0.5) * 0.35;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      for (let i = 0; i < N; i++) {
        // 0-1.1 שניות: כדור מסתובב; אחר כך כל נקודה טסה למקומה במילה
        const m = ease(clamp01((time - 1.1 - delay[i]) / 1.3)) * (1 - back);
        const [x, y, z] = sphere[i];
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cx - z1 * sx;
        const z2 = y * sx + z1 * cx;
        const k = focal / (focal + z2 * R);
        const sxp = w / 2 + x1 * R * k;
        const syp = h / 2 + y1 * R * k;
        const [tx, ty] = target[i];
        const px = sxp + (tx - sxp) * m;
        const py = syp + (ty - syp) * m;
        const depth = Math.max(0.25, Math.min(1, 0.6 - z2 * 0.4));
        ctx.globalAlpha = m > 0.5 ? 0.55 + m * 0.45 : depth;
        ctx.fillStyle = title;
        const r = 1.8;
        ctx.fillRect(px - r / 2, py - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
      // בסוף - המילה החדה נחשפת מעל הנקודות (ובלופ - דוהה לפני ההתפרקות)
      const ready = clamp01((time - 2.9) / 0.6) * (loop && !reduced ? 1 - clamp01((time - 5.9) / 0.5) : 1);
      if (ready > 0) {
        ctx.globalAlpha = ready;
        mask.paint(ctx, title);
        ctx.globalAlpha = 1;
      }
      return loop && !reduced ? false : ready >= 1;
    };
  });
  return <EffectBox canvasRef={ref} text={text} className={className} />;
}

/* ==========================================================================
   דיו - טיפות נוחתות ונספגות לתוך האותיות, ואז המשפט מתחדד
   ========================================================================== */

export function InkText({ text, className }: { text: string; className?: string }) {
  const ref = useCanvasEffect(text, (ctx, w, h, reduced) => {
    const { ink } = readColors();
    const mask = buildMask(text, w, h, { maxLines: 5 });
    const CELL = 3;
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    const inside = new Uint8Array(cols * rows);
    const done = new Uint8Array(cols * rows);
    let total = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        if (mask.at(i * CELL + 1, j * CELL + 1) > 0.35) {
          inside[j * cols + i] = 1;
          total++;
        }
    // כל "כתם" רציף (בדרך כלל אות אחת - אותיות עבריות לא מחוברות זו לזו)
    // מקבל טיפה משלו. קודם הדיו התפשט רק מכמה טיפות, וכל אות נפרדת חיכתה
    // לתורה - משפט ארוך לא הושלם גם אחרי 8 שניות.
    const comp = new Int32Array(cols * rows).fill(-1);
    const seeds: { k: number; x: number }[] = [];
    for (let k0 = 0; k0 < inside.length; k0++) {
      if (!inside[k0] || comp[k0] >= 0) continue;
      const id = seeds.length;
      const stack = [k0];
      comp[k0] = id;
      let pick = k0;
      let count = 0;
      while (stack.length) {
        const k = stack.pop()!;
        // נקודת הנחיתה - תא אקראי בתוך הכתם
        if (Math.random() * ++count < 1) pick = k;
        const i = k % cols;
        const j = (k / cols) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const nk = nj * cols + ni;
          if (inside[nk] && comp[nk] < 0) {
            comp[nk] = id;
            stack.push(nk);
          }
        }
      }
      seeds.push({ k: pick, x: pick % cols });
    }

    // שכבת הספיגה ברזולוציית התאים, מוגדלת ומטושטשת - נראית כמו צבעי מים
    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const oc = off.getContext("2d")!;
    oc.fillStyle = ink;

    // הטיפות נוחתות לפי סדר הקריאה - מימין לשמאל - לאורך DROP_SPAN שניות
    const DROP_SPAN = 1.7;
    const FILL_SECONDS = 2.6;
    const order = seeds
      .map((s, i) => ({ ...s, i }))
      .sort((a, b) => b.x - a.x + (Math.random() - 0.5) * 6);
    const pending = order.map((s, n) => {
      const x = (s.k % cols) * CELL;
      const y = ((s.k / cols) | 0) * CELL;
      return {
        k: s.k,
        at: 0.15 + (n / Math.max(1, order.length)) * DROP_SPAN,
        // ניתזים רק לחלק מהטיפות - אחרת משפט ארוך מתמלא נקודות
        splat:
          n % 3 === 0
            ? Array.from({ length: 3 }, () => {
                const a = Math.random() * Math.PI * 2;
                const d = 8 + Math.random() * 28;
                return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 0.8 + Math.random() * 1.6 };
              })
            : [],
      };
    });
    const drops: typeof pending = [];
    const front: number[] = [];
    let filled = 0;

    return (t, dt) => {
      const time = reduced ? 99 : t;
      // טיפות שהגיע זמנן
      while (pending.length && pending[0].at <= time) {
        const d = pending.shift()!;
        drops.push(d);
        front.push(d.k);
      }
      // הדיו מתפשט לתאים שכנים בתוך האותיות
      let budget = reduced ? total : Math.ceil((total / FILL_SECONDS) * dt * 1.4);
      while (budget-- > 0 && front.length) {
        const idx = (Math.random() * front.length) | 0;
        const k = front[idx];
        front[idx] = front[front.length - 1];
        front.pop();
        if (done[k]) continue;
        done[k] = 1;
        filled++;
        oc.globalAlpha = 0.75 + Math.random() * 0.25;
        oc.fillRect(k % cols, (k / cols) | 0, 1, 1);
        const i = k % cols;
        const j = (k / cols) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const nk = nj * cols + ni;
          if (inside[nk] && !done[nk]) front.push(nk);
        }
      }

      ctx.clearRect(0, 0, w, h);
      // ניתזים קטנים סביב כל טיפה
      ctx.fillStyle = ink;
      for (const d of drops) {
        const age = time - d.at;
        ctx.globalAlpha = Math.min(0.5, age * 2) * (1 - clamp01((time - FILL_SECONDS - 1.5) / 1));
        for (const p of d.splat) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * Math.min(1, age * 4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // כשהספיגה כמעט מלאה - המשפט מתחדד לטקסט נקי וקריא, ושכבת הספיגה
      // המטושטשת דוהה מתחתיו (אחרת נשארת "הילה" עכורה סביב האותיות)
      const full = total ? filled / total : 1;
      const sharp = clamp01((full - 0.9) / 0.1);
      ctx.save();
      ctx.globalAlpha = 1 - sharp;
      ctx.imageSmoothingEnabled = true;
      ctx.filter = "blur(1px)";
      ctx.drawImage(off, 0, 0, cols * CELL, rows * CELL);
      ctx.restore();
      if (sharp > 0) {
        ctx.globalAlpha = sharp;
        mask.paint(ctx, ink);
        ctx.globalAlpha = 1;
      }
      return sharp >= 1 && time > FILL_SECONDS + 2.6;
    };
  });
  return <EffectBox canvasRef={ref} text={text} className={className} />;
}
