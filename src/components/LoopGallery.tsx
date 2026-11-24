import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PortalHostContext } from "../lib/portalHost";

/**
 * גלריית הלופים של המסך הגדול - /screen/4?loop=gallery (2026-11-24, בקשת הלקוחה).
 *
 * קודם מסך "ברוכות הבאות"; נגיעה (או כמה שניות) מעבירה לעמוד שבו כל הלופים
 * פזורים כריבועים על רשת העמודות של העיצוב. נגיעה בריבוע: הוא מתכווץ קצת
 * בלחיצה, גדל קצת בשחרור, ומתוכו נפתח חלון עם הלופ - לא על כל המסך, אלא
 * חלון ממוסגר. אפשר לפתוח כמה חלונות יחד (ראו Gallery).
 *
 * הלופ עצמו מצויר בגודל מסך מלא ומוקטן ב-transform לתוך החלון - כך הוא נראה
 * בדיוק כמו במסך המלא, רק קטן יותר, ושכבות "fixed" בתוכו (טיפים, כלל הפרקטל)
 * נשארות בתוך החלון ולא בורחות לכל המסך.
 */

export interface GalleryItem {
  key: string;
  /** מספר השלב שהלופ שייך לו */
  stage: number;
  title: string;
  /** loop - לופ "פרקטל..."; screen - מסך נוסף של אותו שלב; welcome - הפתיחה */
  kind: "loop" | "screen" | "welcome";
  /** שורת פתיחה מתוך הלופ עצמו (החידה הראשונה וכו׳) - מוצגת בכרטיס בעמוד המסע */
  teaser?: string;
}

/** כמה שניות מסך "ברוכות הבאות" מוצג לפני שעוברים לבד לגלריה */
const WELCOME_SECONDS = 12;
/** כל כמה זמן המסגרת האדומה עוברת לריבוע אחר */
const HINT_MS = 2600;
/** משך פתיחה/סגירה של לופ */
const OPEN_MS = 520;

/*
 * מיקום כל ריבוע על הרשת: עמודה (0-7, מימין) ושורה (0-3), ותזוזה קטנה בתוך
 * התא כדי שזה ייראה מפוזר ולא כמו טבלה. לפי סדר הפריטים.
 */
const SPOTS: { col: number; row: number; dx: number; dy: number }[] = [
  { col: 0, row: 0, dx: 0.2, dy: 0.1 },
  { col: 1, row: 0, dx: -0.15, dy: 0.25 },
  { col: 3, row: 0, dx: 0.1, dy: -0.05 },
  { col: 6, row: 0, dx: -0.2, dy: 0.15 },
  { col: 2, row: 1, dx: 0.15, dy: -0.1 },
  { col: 4, row: 1, dx: -0.1, dy: 0.2 },
  { col: 5, row: 1, dx: 0.2, dy: -0.15 },
  { col: 7, row: 1, dx: -0.1, dy: 0.05 },
  { col: 0, row: 2, dx: -0.15, dy: -0.1 },
  { col: 3, row: 2, dx: 0.2, dy: 0.2 },
  { col: 6, row: 2, dx: 0.05, dy: -0.2 },
  { col: 1, row: 3, dx: 0.1, dy: -0.15 },
  { col: 2, row: 3, dx: -0.2, dy: 0.1 },
  { col: 5, row: 3, dx: 0.15, dy: -0.05 },
  { col: 7, row: 3, dx: -0.15, dy: -0.2 },
];

function LoopGallery({
  items,
  welcome,
  renderItem,
}: {
  items: GalleryItem[];
  welcome: ReactNode;
  renderItem: (key: string, step: number) => ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entered) return;
    const t = window.setTimeout(() => setEntered(true), WELCOME_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [entered]);

  if (!entered) {
    return (
      <div className="lg-welcome" onClick={() => setEntered(true)}>
        {welcome}
      </div>
    );
  }
  return <Gallery items={items} renderItem={renderItem} />;
}

/*
 * לופ פתוח (2026-11-24, לפי הלקוחה):
 *   - "30 ס"מ על 21 ס"מ יהיה גודלו של לופ אחרי שלחצו עליו" - ביחס למסך הגדול
 *     (כ-196×116 ס"מ), כלומר כ-15% מהרוחב וכ-18% מהגובה.
 *   - "שלא יקפוץ למקום אחר" - הלופ נפתח בדיוק על הריבוע שלו. מותר לו להסתיר
 *     ריבועים סגורים, אבל לא לופ פתוח אחר: אם יש התנגשות, הוא זז רק כמה שצריך.
 *   - "שיעברו בצורה ידנית ולא לבד" - כל נגיעה בלופ מעבירה לשקף הבא, והחצים
 *     בפס התחתון קדימה ואחורה.
 */
const ROOM_W_CM = 196;
const ROOM_H_CM = 116;
const OPEN_W_CM = 30;
const OPEN_H_CM = 21;
/** מרווח מינימלי מקצה המסך ובין לופים פתוחים (חלק מרוחב המסך) */
const EDGE = 0.006;
const GAP = 0.006;

/*
 * כל האתר מוקטן ב-zoom (--ui-scale ב-index.css), ולכן innerWidth הוא פיקסלים של
 * המסך, אבל left/width שכותבים ב-style נמדדים בפיקסלים של CSS - שגדלים פי
 * ui-scale. בלי ההמרה המסגרת יצאה 15% קטנה מהלופ שבתוכה, והלופ נחתך.
 */
function uiScale() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
}

interface Box {
  left: number;
  top: number;
}

/** גודל לופ פתוח בפיקסלים של המסך */
function openSize() {
  return { w: window.innerWidth * (OPEN_W_CM / ROOM_W_CM), h: window.innerHeight * (OPEN_H_CM / ROOM_H_CM) };
}

/*
 * איפה הלופ נפתח: ממורכז על הריבוע שלו (בתוך המסך, מתחת לכותרת). אם הוא עולה
 * על לופ פתוח אחר - המקום הפנוי הקרוב ביותר. בפיקסלים של המסך.
 */
function findSpot(from: DOMRect, taken: Box[]): Box {
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  const { w, h } = openSize();
  const edge = iw * EDGE;
  const gap = iw * GAP;
  const minX = edge;
  const maxX = iw - w - edge;
  const minY = ih * 0.12;
  const maxY = ih - h - edge;
  const clampX = (x: number) => Math.min(maxX, Math.max(minX, x));
  const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
  const want = {
    left: clampX(from.left + from.width / 2 - w / 2),
    top: clampY(from.top + from.height / 2 - h / 2),
  };
  const free = (x: number, y: number) =>
    taken.every((t) => x + w + gap <= t.left || t.left + w + gap <= x || y + h + gap <= t.top || t.top + h + gap <= y);
  if (free(want.left, want.top)) return want;

  let best: Box = want;
  let bestD = Infinity;
  const xs = [want.left];
  const ys = [want.top];
  for (const t of taken) {
    xs.push(t.left + w + gap, t.left - w - gap);
    ys.push(t.top + h + gap, t.top - h - gap);
  }
  const step = Math.max(8, Math.round(iw / 200));
  for (let x = minX; x <= maxX; x += step) xs.push(x);
  for (let y = minY; y <= maxY; y += step) ys.push(y);
  for (const x0 of xs) {
    const x = clampX(x0);
    for (const y0 of ys) {
      const y = clampY(y0);
      if (!free(x, y)) continue;
      const d = (x - want.left) ** 2 + (y - want.top) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { left: x, top: y };
      }
    }
  }
  return best;
}

interface Grown {
  i: number;
  /** הריבוע שממנו הלופ נפתח (מיקום על המסך) */
  from: DOMRect;
  /** איפה הלופ עומד (פיקסלים של המסך) */
  at: Box;
}

function Gallery({
  items,
  renderItem,
}: {
  items: GalleryItem[];
  renderItem: (key: string, step: number) => ReactNode;
}) {
  const [grown, setGrown] = useState<Grown[]>([]);
  const [popping, setPopping] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const release = (i: number) => {
    // מתכווץ בלחיצה (CSS), גדל קצת בשחרור, ומיד נפתח
    setPopping(i);
    window.setTimeout(() => {
      setPopping(null);
      const rect = buttons.current[i]?.getBoundingClientRect();
      if (!rect) return;
      setGrown((g) => (g.some((x) => x.i === i) ? g : [...g, { i, from: rect, at: findSpot(rect, g.map((x) => x.at)) }]));
    }, 180);
  };

  const shrink = (i: number) => setGrown((g) => g.filter((x) => x.i !== i));

  // מסגרת אדומה שעוברת לאט בין הריבועים - מזמינה לגעת
  const [hint, setHint] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setHint((h) => (h + 7) % items.length), HINT_MS);
    return () => window.clearInterval(t);
  }, [items.length]);

  return (
    <main className="lg-page" dir="rtl">
      <div className="rl-grid" aria-hidden="true" />
      <header className="lg-head">
        <span className="lg-head__count">{items.length}</span>
        <span className="lg-head__text">
          <span className="lg-head__title">כל הלופים של הסדנה</span>
          <span className="lg-head__sub">נגעו בריבוע כדי לפתוח</span>
        </span>
        <svg viewBox="0 0 24 24" className="lg-head__arrow" aria-hidden="true">
          <path d="M19 5 L5 19 M5 8 L5 19 L16 19" />
        </svg>
      </header>

      <ul className="lg-field">
        {items.map((item, i) => {
          const spot = SPOTS[i % SPOTS.length];
          const isGrown = grown.some((g) => g.i === i);
          return (
            <li
              key={item.key}
              className={`lg-cell lg-cell--${item.kind}`}
              style={
                {
                  "--col": spot.col,
                  "--row": spot.row,
                  "--dx": spot.dx,
                  "--dy": spot.dy,
                  animationDelay: `${0.15 + i * 0.05}s`,
                } as CSSProperties
              }
            >
              <button
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                className={`lg-tile lg-tile--${item.kind}${popping === i ? " is-pop" : ""}${isGrown ? " is-source" : ""}${hint === i && !isGrown ? " is-hint" : ""}`}
                onClick={() => release(i)}
                aria-label={`פתיחת ${item.title}`}
                aria-expanded={isGrown}
              >
                <span className="lg-tile__top">
                  <span className="lg-tile__num">{String(item.stage).padStart(2, "0")}</span>
                  <TileGlyph name={item.key} />
                </span>
                <span className="lg-tile__title">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {grown.map((g) => (
        <GrownTile
          key={items[g.i].key}
          item={items[g.i]}
          from={g.from}
          at={g.at}
          getTileRect={() => buttons.current[g.i]?.getBoundingClientRect() ?? null}
          onClose={() => shrink(g.i)}
          renderItem={renderItem}
        />
      ))}
    </main>
  );
}

/**
 * לופ פתוח: 30×21 ס"מ על המסך הגדול. למעלה הלופ עצמו (מצויר בגודל מסך מלא
 * ומוקטן לרוחב המסגרת), ולמטה פס עם קודם / הבא / סגירה. נגיעה בלופ = השקף הבא.
 */
function GrownTile({
  item,
  from,
  at,
  getTileRect,
  onClose,
  renderItem,
}: {
  item: GalleryItem;
  from: DOMRect;
  at: Box;
  getTileRect: () => DOMRect | null;
  onClose: () => void;
  renderItem: (key: string, step: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // המסגרת היא "הגוף" של הטיפים ושל כלל הפרקטל (שנפתחים ב-portal)
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);
  const closing = useRef(false);
  const ui = uiScale();

  const { w, h } = openSize();
  // הלופ ביחס המסך, לרוחב המסגרת; מה שנשאר מהגובה - פס הכפתורים
  const k = w / window.innerWidth;
  const stageH = window.innerHeight * k;
  const barH = Math.max(0, h - stageH);
  const { left, top } = at;

  const toward = (rect: DOMRect | null): Keyframe | null => {
    if (!rect) return null;
    const tx = rect.left + rect.width / 2 - (left + w / 2);
    const ty = rect.top + rect.height / 2 - (top + h / 2);
    return { transform: `translate(${tx / ui}px, ${ty / ui}px) scale(${rect.width / w}, ${rect.height / h})`, opacity: 0.5 };
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const start = toward(from);
    if (!el || !start || typeof el.animate !== "function") return;
    el.animate([start, { transform: "none", opacity: 1 }], { duration: OPEN_MS, easing: "cubic-bezier(.2,.8,.2,1)" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFitText(ref);

  const close = () => {
    if (closing.current) return;
    const el = ref.current;
    const end = toward(getTileRect());
    if (!el || !end || typeof el.animate !== "function") return onClose();
    closing.current = true;
    const anim = el.animate([{ transform: "none", opacity: 1 }, end], {
      duration: OPEN_MS * 0.8,
      easing: "cubic-bezier(.6,0,.4,1)",
      fill: "forwards",
    });
    anim.onfinish = onClose;
  };

  return (
    <div
      ref={ref}
      className="lg-grown"
      style={{ left: left / ui, top: top / ui, width: w / ui, height: h / ui, "--k": k } as CSSProperties}
    >
      <div
        className="lg-grown__view"
        style={{ height: stageH / ui }}
        onClick={() => setStep((s) => s + 1)}
        role="button"
        aria-label={`${item.title} - השקף הבא`}
      >
        <div className="lg-panel__stage" ref={setHost}>
          <div className="lg-panel__screen">
            {host && <PortalHostContext.Provider value={host}>{renderItem(item.key, step)}</PortalHostContext.Provider>}
          </div>
        </div>
      </div>
      <div className="lg-grown__bar" style={{ height: barH / ui }}>
        <button type="button" className="lg-grown__btn" onClick={() => setStep((s) => s - 1)} aria-label="השקף הקודם">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: "scaleX(-1)" }}>
            <path d="M20 12 H4 M10 6 L4 12 L10 18" />
          </svg>
        </button>
        <span className="lg-grown__name">{item.title}</span>
        <button type="button" className="lg-grown__btn" onClick={() => setStep((s) => s + 1)} aria-label="השקף הבא">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12 H4 M10 6 L4 12 L10 18" />
          </svg>
        </button>
        <button type="button" className="lg-grown__btn lg-grown__close" onClick={close} aria-label={`סגירת ${item.title}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5 L19 19 M19 5 L5 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/*
 * הטקסט בריבוע מוגדל מוגדל פי 1.5 (.lg-grown ב-editorial.css). שקף ארוך עלול
 * לא להיכנס - אז מקטינים אותו בהדרגה (--lgf) עד שנכנס, ובשקף הבא מתחילים
 * מחדש מהגודל המלא.
 */
const FIT_STEP = 0.07;
const FIT_MIN = 0.62;

function useFitText(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    let fit = 1;
    let lastText = "";
    const t = window.setInterval(() => {
      const box = ref.current;
      const slide = box?.querySelector<HTMLElement>(".rl-slide");
      if (!box || !slide) return;
      const text = slide.textContent ?? "";
      if (text !== lastText) {
        lastText = text;
        fit = 1;
      } else if (slide.scrollHeight > slide.clientHeight + 2 && fit > FIT_MIN) {
        fit = Math.max(FIT_MIN, fit - FIT_STEP);
      } else return;
      box.style.setProperty("--lgf", String(fit));
    }, 250);
    return () => window.clearInterval(t);
  }, [ref]);
}

/*
 * איור קו דק לכל ריבוע - רמז למה שיש בפנים. ציור פשוט (40×40), באותו קו
 * כמו החיצים של העיצוב.
 */
const GLYPHS: Record<string, string> = {
  // כוכב - פתיחה (חץ כבר יש בפינת הכרטיס)
  welcome: "M20 4 L24 16 L36 20 L24 24 L20 36 L16 24 L4 20 L16 16 Z",
  // עין - קהל
  "2": "M4 20 Q20 6 36 20 Q20 34 4 20 Z M20 15 A5 5 0 1 1 19.9 15 Z",
  // נורה - טיפים
  "2-tips": "M14 28 L26 28 M15 33 L25 33 M14 24 Q8 19 10 12 Q13 5 20 5 Q27 5 30 12 Q32 19 26 24 Z",
  // ריבועים זה בתוך זה - פרקטל
  "2-fractal": "M5 5 H35 V35 H5 Z M12 12 H28 V28 H12 Z M17 17 H23 V23 H17 Z",
  // שלוש דמויות - מי בחדר
  "2-room": "M8 14 A3.5 3.5 0 1 1 7.9 14 Z M20 11 A3.5 3.5 0 1 1 19.9 11 Z M32 14 A3.5 3.5 0 1 1 31.9 14 Z M3 30 Q8 21 13 30 M15 28 Q20 18 25 28 M27 30 Q32 21 37 30",
  // גל
  "3": "M3 20 Q9 10 15 20 T27 20 T39 20 M3 29 Q9 19 15 29 T27 29 T39 29",
  // מאזניים - משקל
  "4": "M20 6 V34 M12 34 H28 M6 12 H34 M6 12 L2 24 H10 Z M34 12 L30 24 H38 Z",
  // וי בריבוע - בפועל
  "4b": "M6 6 H34 V34 H6 Z M12 20 L18 26 L29 13",
  // שני חיצים מתחלפים - מושאל
  "5": "M6 14 H32 M26 8 L32 14 L26 20 M34 27 H8 M14 21 L8 27 L14 33",
  // מעגל עם חץ
  "6": "M32 14 A13 13 0 1 0 33 24 M32 6 V14 H24",
  // בועת שיחה - דיון
  "6-tips": "M5 7 H35 V27 H18 L10 34 V27 H5 Z M11 14 H29 M11 20 H23",
  // מצלמה - הקלטות
  "7": "M4 12 H27 V30 H4 Z M27 18 L36 13 V29 L27 24",
  // ריבועים מוכפלים
  "8": "M5 5 H17 V17 H5 Z M23 5 H35 V17 H23 Z M5 23 H17 V35 H5 Z M23 23 H35 V35 H23 Z",
  // נבט - שדה
  "9": "M20 36 V18 M20 22 Q10 22 8 12 Q18 12 20 22 M20 18 Q22 6 33 6 Q32 17 20 18 M8 36 H32",
  // מירכאות - עיקרון
  "10": "M8 10 H17 L13 24 Q12 30 7 32 M23 10 H32 L28 24 Q27 30 22 32",
};

function TileGlyph({ name }: { name: string }) {
  const d = GLYPHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 40 40" className="lg-tile__glyph" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default LoopGallery;
