/*
 * ============================================================================
 *  טקסט מחול - "זרמי חול נשפכים מראש המסך וממלאים את האותיות מלמטה למעלה"
 * ============================================================================
 *
 *  לפי אפקט "חול" שהלקוחה שלחה (new-effects.html), כמו שעון חול:
 *   - הגרגרים נופלים **מראש המסך** (לא מעל הטקסט בלבד) - לכן הציור נעשה על
 *     canvas שמכסה את כל החלון (portal ל-body, באג 6 ב-CLAUDE.md), והטקסט
 *     עצמו רק "שומר מקום" בפריסה.
 *   - האותיות נבנות מלמטה למעלה, והמילה **נשארת עשויה מגרגרים** - כמו
 *     בקובץ של הלקוחה. בלי התפרקות בסוף: שם המנצחת נשאר על המסך.
 *   - הגרגרים בצבעי הקשת של הסדנה (מהטוקנים), כך שזה עובד במצב הבהיר והכהה.
 *   - הפונט הוא Assistant הארוז בפרויקט.
 *   - Canvas דו-ממדי בלבד, בלי WebGL - הדפדפן בפלזמה לא ידוע ואולי ישן
 *     (סעיף 2 ב-CLAUDE.md). הציור נעצר ברגע שהכול התיישב.
 *   - ב-prefers-reduced-motion המילה מוצגת מוכנה, בלי שפיכה.
 *
 *  הטקסט המלא קיים גם לקוראי מסך (sr-only).
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Grain {
  tx: number; // מקום היעד בתוך האות (קואורדינטות החלון)
  ty: number;
  y: number; // מיקום נוכחי (נופל רק אנכית)
  vy: number;
  release: number; // מתי הגרגר משתחרר (שניות)
  landed: boolean;
  color: string;
}

/** כמה זמן לוקחת השפיכה כולה, בשניות. */
const POUR_SECONDS = 3.6;
const GRAVITY = 1700;
const STEP = 2.5; // צפיפות הגרגרים (px) - צפוף, כדי שהמילה תיקרא כחול מלא
const GRAIN = 2;
/** המתנה לפני המדידה - שהכניסה המונפשת של המסך תסתיים והטקסט יעמוד במקומו. */
const SETTLE_MS = 450;

function SandText({ text, className }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ds-text").trim() || "#121430";
    const rainbow = [1, 2, 3, 4, 5].map((n) => css.getPropertyValue(`--ds-rainbow-${n}`).trim() || ink);

    let grains: Grain[] = [];
    let vw = 0;
    let vh = 0;
    let frame = 0;
    let start = 0;
    let last = 0;
    let cancelled = false;

    function build() {
      const dpr = window.devicePixelRatio || 1;
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas!.width = Math.max(1, Math.round(vw * dpr));
      canvas!.height = Math.max(1, Math.round(vh * dpr));

      // מסכת הטקסט: כותבים בגדול על canvas נסתר בגודל המקום השמור, וקוראים איפה יש דיו
      const rect = box!.getBoundingClientRect();
      const bw = Math.max(1, Math.round(rect.width));
      const bh = Math.max(1, Math.round(rect.height));
      const mask = document.createElement("canvas");
      mask.width = bw;
      mask.height = bh;
      const m = mask.getContext("2d")!;
      m.direction = "rtl";
      m.textAlign = "center";
      m.textBaseline = "middle";
      let size = bh * 0.86;
      m.font = `800 ${size}px Assistant, sans-serif`;
      while (m.measureText(text).width > bw * 0.96 && size > 12) {
        size -= 1;
        m.font = `800 ${size}px Assistant, sans-serif`;
      }
      m.fillStyle = "#000";
      m.fillText(text, bw / 2, bh / 2);
      const data = m.getImageData(0, 0, bw, bh).data;

      const next: Grain[] = [];
      for (let y = 0; y < bh; y += STEP) {
        for (let x = 0; x < bw; x += STEP) {
          const px = Math.floor(x);
          const py = Math.floor(y);
          if (data[(py * bw + px) * 4 + 3] < 130) continue;
          // הקשת מימין לשמאל, כמו בכותרות
          const band = Math.min(rainbow.length - 1, Math.floor((1 - x / bw) * rainbow.length));
          next.push({
            tx: rect.left + x + (Math.random() - 0.5) * 1.6,
            ty: rect.top + y + (Math.random() - 0.5) * 1.6,
            // מראש המסך (ומעט מעליו) - זרמים ארוכים, כמו שעון חול
            y: -Math.random() * vh * 0.25,
            vy: 0,
            release: 0,
            landed: false,
            color: rainbow[band],
          });
        }
      }
      // ממלאים מלמטה למעלה: הגרגרים הנמוכים משתחררים ראשונים
      next.sort((a, b) => b.ty - a.ty + (Math.random() - 0.5) * 18);
      next.forEach((g, i) => (g.release = (i / Math.max(1, next.length)) * POUR_SECONDS));
      grains = next;
    }

    function draw(now: number) {
      if (!start) start = now;
      const t = (now - start) / 1000;
      // הזמן האמיתי מאז הפריים הקודם (עד 50ms) - כך החול נופל באותה
      // מהירות גם בפלזמה איטית שמציירת פחות מ-60 פריימים בשנייה
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const dpr = window.devicePixelRatio || 1;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, vw, vh);

      let allLanded = true;
      for (const g of grains) {
        if (reduced) {
          g.landed = true;
          g.y = g.ty;
        } else if (!g.landed) {
          if (t < g.release) {
            allLanded = false;
            continue;
          }
          g.vy += GRAVITY * dt;
          g.y += g.vy * dt;
          if (g.y >= g.ty) {
            g.y = g.ty;
            g.landed = true;
          } else {
            allLanded = false;
          }
        }
        ctx!.fillStyle = g.color;
        ctx!.fillRect(g.tx, g.y, GRAIN, GRAIN);
      }

      // ממשיכים לצייר רק עד שהכול התיישב - אחר כך אין מה לעדכן
      if (!cancelled && !allLanded) frame = requestAnimationFrame(draw);
    }

    // מחכים לפונט (Assistant ארוז מקומית) ולסוף הכניסה של המסך, כדי שהמסכה
    // תיבנה בצורה הנכונה ובמקום הנכון
    let timer = 0;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        build();
        frame = requestAnimationFrame(draw);
      }, SETTLE_MS);
    });

    // שינוי גודל - בונים מחדש ומציגים את המילה מוכנה (בלי לשפוך שוב)
    function rebuildSettled() {
      if (!grains.length) return;
      build();
      grains.forEach((g) => {
        g.landed = true;
        g.y = g.ty;
      });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", rebuildSettled);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", rebuildSettled);
    };
  }, [text]);

  return (
    <>
      {/* שומר את המקום של המילה בפריסה; הציור עצמו על ה-canvas שמכסה את החלון */}
      <div ref={boxRef} className={className}>
        <span className="sr-only">{text}</span>
      </div>
      {createPortal(
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 h-full w-full"
        />,
        document.body,
      )}
    </>
  );
}

export default SandText;
