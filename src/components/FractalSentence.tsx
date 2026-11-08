/*
 * ============================================================================
 *  משפט פרקטלי - "חלק קטן, אבל כבר רואים בו את השלם"
 * ============================================================================
 *
 *  לפי סרטון ה-g שהלקוחה שלחה: שדה של אותיות קטנות שמסתחרר במערבולת
 *  ספירלית, ומתוכו **המשפט עצמו נבנה מאותיות קטנות** - האות הגדולה
 *  עשויה מהאותיות הקטנות, כמו פרקטל. המשפט מחזיק רגע, מתפרק בחזרה
 *  למערבולת, ונבנה שוב - בלופ.
 *
 *  שני סוגי חלקיקים:
 *   - אין שדה רקע: רק האותיות שבונות את המשפט. במערבולת הן מסתחררות (סיבוב שתלוי במרחק
 *     מהמרכז - זה מה שיוצר את הספירלה).
 *   - משפט: אותיות זעירות שנדגמות מצורת המשפט (מסכה ב-canvas נסתר).
 *     במערבולת הן מתערבבות ברקע, ובשלב הבנייה הן עפות אל מקומן במשפט.
 *
 *  Canvas ולא DOM (כאלף אותיות בכל פריים). בלי רקע משלו - יושב על
 *  הכרטיס: אותיות הרקע בצבע הטקסט ושקופות, והמשפט בצבעי הקשת של
 *  הכותרות. הצבעים נקראים מהטוקנים, אז זה עובד גם במצב הכהה. ב-prefers-reduced-motion המשפט
 *  מוצג בנוי, בלי תנועה. הטקסט המלא קיים גם לקוראי מסך.
 */

import { useEffect, useRef } from "react";

const TEXT_SPACING = 3;
const CYCLE_MS = 9000;

interface Particle {
  hx: number; // מקום בבית (רשת הרקע / נקודה אקראית במערבולת)
  hy: number;
  tx: number; // מקום במשפט (רק לחלקיקי משפט)
  ty: number;
  ch: string;
  text: boolean;
  color: string;
  spin: number;
}

/** 0 = מערבולת מלאה, 1 = המשפט בנוי. עקומה רכה עם החזקה בכל קצה. */
function formAmount(t: number) {
  const p = (t % CYCLE_MS) / CYCLE_MS;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (p < 0.22) return 0; // מסתחרר
  if (p < 0.42) return ease((p - 0.22) / 0.2); // נבנה
  if (p < 0.72) return 1; // מחזיק
  if (p < 0.9) return 1 - ease((p - 0.72) / 0.18); // מתפרק
  return 0;
}

function FractalSentence({ text, className }: { text: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const letters = text.replace(/[^֐-׿]/g, "") || "פרקטל";
    let particles: Particle[] = [];
    let fontSpec = "";
    let w = 0;
    let h = 0;
    let frame = 0;
    let cancelled = false;

    // צבעי העיצוב הקיים: אותיות הרקע בצבע הטקסט (שקופות), והמשפט בקשת -
    // אותו גרדיאנט כמו הכותרות, מימין לשמאל
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ds-text").trim() || "#121430";
    const rainbow = [1, 2, 3, 4, 5].map((n) => css.getPropertyValue(`--ds-rainbow-${n}`).trim() || ink);

    function build() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));

      // מסכת המשפט: כותבים אותו בגדול על canvas נסתר וקוראים איפה יש דיו
      const mask = document.createElement("canvas");
      mask.width = Math.round(w);
      mask.height = Math.round(h);
      const m = mask.getContext("2d")!;
      m.direction = "rtl";
      m.textAlign = "center";
      m.textBaseline = "middle";
      m.fillStyle = "#000";
      // שורה אחת תמיד (לבקשת הלקוחה - לא לחצות את המשפט), בגודל המרבי שנכנס
      // גובה עד חצי מהלוח ורוחב עד 88% - כך גם ק/ן היורדות וגם הקצוות לא נחתכים
      // 0.62 (קודם 0.5) - כתב גדול יותר לבקשת הלקוחה
      let size = h * 0.62;
      m.font = `800 ${size}px Assistant, sans-serif`;
      while (m.measureText(text).width > w * 0.94 && size > 12) {
        size -= 1;
        m.font = `800 ${size}px Assistant, sans-serif`;
      }
      m.fillText(text, w / 2, h * 0.44);
      fontSpec = m.font;
      // מעבים את קווי האותיות - בשורה אחת הן דקות, וצריך מקום לאותיות הקטנות
      m.lineWidth = Math.max(1, size * 0.03);
      m.lineJoin = "round";
      m.strokeStyle = "#000";
      m.strokeText(text, w / 2, h * 0.44);
      const data = m.getImageData(0, 0, mask.width, mask.height).data;
      const inked = (x: number, y: number) => data[(Math.round(y) * mask.width + Math.round(x)) * 4 + 3] > 128;

      let seed = 11;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const pick = () => letters[Math.floor(rand() * letters.length)];

      const next: Particle[] = [];
      // משפט: אותיות זעירות צפופות בתוך צורת המשפט
      for (let y = 0; y < h; y += TEXT_SPACING) {
        for (let x = 0; x < w; x += TEXT_SPACING) {
          const jx = x + (rand() - 0.5) * 2;
          const jy = y + (rand() - 0.5) * 2;
          if (jx < 0 || jy < 0 || jx >= w || jy >= h || !inked(jx, jy)) continue;
          // RTL: הקשת מתחילה מימין
          const band = Math.min(rainbow.length - 1, Math.floor((1 - jx / w) * rainbow.length));
          // בית במערבולת: בתוך אליפסה פנימית, כדי שהסיבוב לא יוציא אותיות מהלוח
          const ha = rand() * Math.PI * 2;
          const hr = Math.sqrt(rand()) * 0.85;
          next.push({ hx: w / 2 + Math.cos(ha) * hr * (w / 2), hy: h / 2 + Math.sin(ha) * hr * (h / 2), tx: jx, ty: jy, ch: pick(), text: true, spin: rand() * 6.28, color: rainbow[band] });
        }
      }
      particles = next;
    }

    function draw(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const form = reduced ? 1 : formAmount(now);
      const swirl = 1 - form;
      const cx = w / 2;
      const cy = h / 2;
      const t = now / 1000;

      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      const bgFont = "700 11px Assistant, sans-serif";
      const textFont = `800 ${11 - form * 7}px Assistant, sans-serif`;
      let currentFont = "";
      for (const p of particles) {
        // המערבולת: סיבוב סביב המרכז, חזק יותר קרוב למרכז - ספירלה
        // בקואורדינטות מנורמלות (אליפסה) - כך המערבולת ממלאת את כל הרוחב
        // של לוח רחב-נמוך, ולא נמרחת לפס אלכסוני
        const nx = (p.hx - cx) / cx;
        const ny = (p.hy - cy) / cy;
        const r = Math.min(1, Math.hypot(nx, ny));
        const twist = swirl * (2.4 * (1 - r) + 0.2) * Math.sin(t * 0.5 + r * 2.2);
        const cos = Math.cos(twist);
        const sin = Math.sin(twist);
        const sx = cx + (nx * cos - ny * sin) * cx;
        const sy = cy + (nx * sin + ny * cos) * cy;
        // כיוון האות לאורך הזרם, כמו ב-g שבסרטון
        const rot = Math.atan2(sy - cy, sx - cx) + Math.PI / 2 + p.spin * swirl * 0.25;

        let x = sx;
        let y = sy;
        let alpha = 0.3;
        let angle = rot;
        if (p.text) {
          x = sx + (p.tx - sx) * form;
          y = sy + (p.ty - sy) * form;
          alpha = 0.45 + form * 0.55;
          angle = rot * (1 - form);
        } else {
          // בזמן שהמשפט בנוי, הרקע מתעמעם כדי שהמשפט יבלוט
          alpha = 0.3 - form * 0.2;
        }

        ctx!.globalAlpha = alpha;
        // במערבולת כל האותיות באותו צבע; הקשת מופיעה ככל שהמשפט נבנה
        // תמיד בצבעי הקשת - גם כשהן עפות במערבולת (לבקשת הלקוחה, לא שחור)
        ctx!.fillStyle = p.color;
        const font = p.text ? textFont : bgFont;
        if (font !== currentFont) {
          ctx!.font = font;
          currentFont = font;
        }
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        ctx!.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, x * dpr, y * dpr);
        ctx!.fillText(p.ch, 0, 0);
      }
      ctx!.globalAlpha = 1;

      // בסוף הבנייה המשפט "מוכן": הטקסט עצמו נחשף מעל האותיות הקטנות,
      // חד וברור, בקשת של הכותרות - ונעלם שוב כשהמשפט מתפרק
      const ready = Math.min(1, Math.max(0, (form - 0.8) / 0.2));
      if (ready > 0 && fontSpec) {
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        const grad = ctx!.createLinearGradient(w * 0.94, 0, w * 0.06, 0);
        rainbow.forEach((c, i) => grad.addColorStop(i / (rainbow.length - 1), c));
        ctx!.globalAlpha = ready;
        ctx!.font = fontSpec;
        ctx!.direction = "rtl";
        ctx!.fillStyle = grad;
        ctx!.fillText(text, w / 2, h * 0.44);
        ctx!.globalAlpha = 1;
      }

      if (!reduced && !cancelled) frame = requestAnimationFrame(draw);
    }

    // מחכים לפונט (Assistant ארוז מקומית) כדי שהמסכה תיבנה בצורה הנכונה
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      build();
      frame = requestAnimationFrame(draw);
    });

    const ro = new ResizeObserver(() => {
      if (!particles.length) return;
      build();
      if (reduced) frame = requestAnimationFrame(draw);
    });
    ro.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [text]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-full w-full"
      />
      <span className="sr-only">{text}</span>
    </div>
  );
}

export default FractalSentence;
