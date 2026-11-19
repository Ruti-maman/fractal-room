import { useEffect, useMemo, useState } from "react";
import FractalFullscreen from "./FractalFullscreen";
import {
  MAX_WORDS,
  slideSeconds,
  type IconName,
  type LoopBackground,
  type RoomLoop as Loop,
  type RoomSlide,
  type SlideVisual,
} from "../lib/roomLoops";

/**
 * נגן הלופ של המסך הרביעי (2026-11-19, לפי האפיון של הלקוחה).
 *
 * צפייה בלבד: בלי נגיעות ובלי קול. השקפים מתחלפים לבד לפי המשך שלהם
 * (15-20 שניות, חידות 20-25), במעבר עמעום רך, ובסוף הלופ חוזרים להתחלה.
 * כותרת הלופ קבועה בפינה הימנית העליונה עם ריבוע אדום, ומחוון התקדמות
 * (פס דק, או מעגל בשלב 6) מראה איפה אנחנו בלופ.
 *
 * שקף ארוך מ-MAX_WORDS מילים נחשף בשני שלבים: החצי הראשון מיד, השני
 * באמצע זמן השקף. שקף "closing" מוצג באפקט החלקיקים של "כלל הפרקטל"
 * (FractalFullscreen), וממנו חוזרים לשקף הראשון.
 *
 * התוספות הוויזואליות (visual של שקף, background של לופ) - לפי "אפיון
 * עיצובי" של כל לופ במסמך הלקוחה. כולן קו דק / ספרות דקות בצבעי הפרויקט.
 */

const LETTERS = ["א", "ב", "ג", "ד"];

function wordCount(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

/** מפצל טקסט ארוך לשני חלקים בגבול משפט, קרוב לאמצע. */
function splitInTwo(text: string): [string, string] | null {
  if (wordCount(text) <= MAX_WORDS) return null;
  const sentences = text.match(/[^.?!:]+[.?!:]+["״]?\s*|[^.?!:]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sentences.length < 2) return null;
  const total = wordCount(text);
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < sentences.length - 1; i++) {
    acc += wordCount(sentences[i]);
    cut = i + 1;
    if (acc >= total / 2) break;
  }
  return [sentences.slice(0, cut).join(" "), sentences.slice(cut).join(" ")];
}

/** תוספות שיושבות בצד השמאלי של המסך ולא מעל הטקסט */
const SIDE_VISUALS = new Set<SlideVisual["type"]>(["growingList", "squares"]);

function RoomLoop({ loop, startAt = 0 }: { loop: Loop; startAt?: number }) {
  const [index, setIndex] = useState(startAt);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const slide = loop.slides[index];
  const seconds = slideSeconds(slide);

  // לופ חדש (החדר עבר שלב) - מתחילים מהשקף הראשון
  useEffect(() => {
    setIndex(startAt);
    setStartedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  const next = () => {
    setIndex((i) => (i + 1) % loop.slides.length);
    setStartedAt(Date.now());
  };

  // מעבר אוטומטי (חוץ משקף הסיום - שם החלקיקים קובעים מתי לסיים)
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    if (slide.kind === "closing") return () => clearInterval(tick);
    const t = setTimeout(next, seconds * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loop]);

  const elapsedMs = Math.max(0, now - startedAt);
  const elapsed = Math.min(1, elapsedMs / (seconds * 1000));
  const progress = (index + elapsed) / loop.slides.length;

  // אפשרויות של שקף תשובה - מהחידה האחרונה שלפניו
  const answerOptions = useMemo(() => {
    if (slide.kind !== "answer") return undefined;
    for (let i = index - 1; i >= 0; i--) {
      const s = loop.slides[i];
      if (s.kind === "riddle") return s.options;
    }
    return undefined;
  }, [slide, index, loop]);

  if (slide.kind === "closing") {
    return (
      <FractalFullscreen key={`closing-${index}`} variant="editorial" title={loop.title} text={slide.text} onDone={next} />
    );
  }

  const visual = "visual" in slide ? slide.visual : undefined;
  const side = visual && SIDE_VISUALS.has(visual.type) ? visual : undefined;

  return (
    <main className={`rl-page rl-page--${slide.kind}${side ? " rl-page--side" : ""}`} dir="rtl">
      <div className="rl-grid" aria-hidden="true" />
      {loop.background && <LoopBg type={loop.background} step={index} total={loop.slides.length} />}

      {/* כותרת הלופ - קבועה לאורך כל הלופ */}
      <header className="rl-title">
        <span className="rl-title__sq" aria-hidden="true" />
        {loop.title}
      </header>

      {visual?.type === "link" && <LinkBand key={`link-${index}`} visual={visual} />}
      {side && (
        <div key={`side-${index}`} className="rl-side" aria-hidden="true">
          {side.type === "growingList" ? <GrowingList /> : <Squares />}
        </div>
      )}

      <div key={index} className="rl-slide">
        <SlideBody slide={slide} options={answerOptions} reveal={elapsed >= 0.45} elapsedMs={elapsedMs} />
      </div>

      {"source" in slide && slide.source && <p className="rl-source">{slide.source}</p>}

      {/* מחוון ההתקדמות בלופ */}
      {loop.progress === "ring" ? (
        <ProgressRing value={progress} />
      ) : (
        <div className="rl-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </main>
  );
}

interface BodyProps {
  slide: RoomSlide;
  options?: string[];
  reveal: boolean;
  elapsedMs: number;
}

function SlideBody({ slide, options, reveal, elapsedMs }: BodyProps) {
  const visual = "visual" in slide ? slide.visual : undefined;
  const top = visual ? <TopVisual visual={visual} elapsedMs={elapsedMs} /> : null;

  if (slide.kind === "riddle" || slide.kind === "answer") {
    const riddle = slide.kind === "riddle";
    const opts = riddle ? slide.options : options;
    const correct = slide.kind === "answer" ? slide.correct : undefined;
    const label = riddle ? (slide.label ?? "חידה") : "התשובה";
    const alone = visual?.type === "alone";
    // הספירה היורדת בשקף התשובה יושבת בין הכרטיסים להסבר
    const afterOptions = visual?.type === "countDown";
    return (
      <div className={`rl-qa${visual ? " rl-qa--visual" : ""}${alone ? " rl-qa--alone" : ""}`}>
        {!afterOptions && top}
        {!alone && <span className="rl-label">{label}</span>}
        {riddle && <p className="rl-question">{slide.text}</p>}
        {opts && opts.length > 0 && (
          <ul className="rl-options">
            {opts.map((o, i) => (
              <li
                key={i}
                className={correct === undefined ? undefined : i === correct ? "is-correct" : "is-dim"}
                style={{ animationDelay: `${0.4 + i * 0.15}s` }}
              >
                <span className="rl-options__letter">{LETTERS[i]}</span>
                {o}
              </li>
            ))}
          </ul>
        )}
        {afterOptions && top}
        {!riddle && <TwoStep text={slide.text} reveal={reveal} className="rl-answer" />}
      </div>
    );
  }

  if (slide.kind === "explain" || slide.kind === "fact") {
    const cls = ["rl-explain"];
    if (visual?.type === "bigNumber" || visual?.type === "formula") cls.push("rl-explain--number");
    if (visual?.type === "quote") cls.push("rl-explain--quote");
    if (visual?.type === "icon") cls.push("rl-explain--icon");
    return (
      <div className={cls.join(" ")}>
        {top}
        {slide.kind === "explain" && slide.lead && <p className="rl-lead">{slide.lead}</p>}
        {slide.kind === "explain" && <span className="rl-label">{slide.label ?? "ההסבר"}</span>}
        {visual?.type === "stairs" && <Stairs steps={visual.steps} />}
        {visual?.type === "quote" ? (
          <QuoteText text={slide.text} />
        ) : (
          <TwoStep
            text={slide.text}
            reveal={reveal}
            className={`rl-text${visual?.type === "stairs" ? " rl-text--after-stairs" : ""}`}
          />
        )}
      </div>
    );
  }

  if (slide.kind === "now") {
    return (
      <div className="rl-now">
        <span className="rl-now__label">ועכשיו אצלכן</span>
        <p className="rl-now__text">{slide.text}</p>
      </div>
    );
  }

  return null;
}

/** טקסט שנחשף בשני שלבים אם הוא ארוך (האפיון: עד כ-25 מילים בשקף). */
function TwoStep({ text, reveal, className }: { text: string; reveal: boolean; className: string }) {
  const parts = splitInTwo(text);
  if (!parts) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      {parts[0]}{" "}
      <span className="rl-second" style={{ opacity: reveal ? 1 : 0 }}>
        {parts[1]}
      </span>
    </p>
  );
}

/* ==========================================================================
   תוספות ויזואליות
   ========================================================================== */

/** תוספת שיושבת מעל הטקסט, בתוך עמודת השקף. */
function TopVisual({ visual, elapsedMs }: { visual: SlideVisual; elapsedMs: number }) {
  switch (visual.type) {
    case "eyes":
      return <EyesDrawing />;
    case "bigNumber":
      return <BigNumber value={visual.value} />;
    case "countdown":
      return <Countdown seconds={visual.seconds} elapsedMs={elapsedMs} />;
    case "formula":
      return (
        <span className="rl-formula" dir="ltr">
          {visual.value}
        </span>
      );
    case "forces":
      return <Forces released={visual.released} />;
    case "countDown":
      return <CountDown from={visual.from} to={visual.to} suffix={visual.suffix} />;
    case "contrast":
      return (
        <div className="rl-contrast">
          <p className="rl-contrast__dim">{visual.dim}</p>
          <p className="rl-contrast__bold">{visual.bold}</p>
        </div>
      );
    case "converge":
      return <Converge />;
    case "dip":
      return (
        <svg className="rl-dip" viewBox="0 0 400 110" aria-hidden="true">
          <line className="rl-dip__base" x1="0" y1="40" x2="400" y2="40" />
          <path className="rl-draw" pathLength={1} d="M0 40 C60 40 90 100 150 100 S260 60 400 6" />
          <circle className="rl-dip__low" cx="150" cy="100" r="6" />
        </svg>
      );
    case "icon":
      return <LineIcon name={visual.name} className="rl-tool-icon" />;
    case "quote":
      return (
        <span className="rl-quote-mark" aria-hidden="true">
          ״
        </span>
      );
    default:
      return null;
  }
}

/** זוג עיניים בקו דק שמצטייר (מבחן "קריאת העיניים"). */
function EyesDrawing() {
  const eye = (cx: number) => (
    <g>
      <path
        className="rl-draw"
        pathLength={1}
        d={`M${cx - 70} 60 Q${cx} 0 ${cx + 70} 60 Q${cx} 120 ${cx - 70} 60 Z`}
      />
      <circle className="rl-draw rl-draw--late" pathLength={1} cx={cx} cy={60} r={24} />
      <circle className="rl-eyes__pupil" cx={cx} cy={60} r={8} />
    </g>
  );
  return (
    <svg className="rl-eyes" viewBox="0 0 400 120" aria-hidden="true">
      {eye(100)}
      {eye(300)}
    </svg>
  );
}

/** ספירה חלקה מ-from ל-to (לאנימציית מספרים). */
function useCount(from: number, to: number, duration = 1800, delay = 300) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const step = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / duration));
      setV(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration, delay]);
  return v;
}

/** מספר ענק ודק שנספר מ-0 עד הערך. */
function BigNumber({ value }: { value: string }) {
  const target = Number(value);
  const numeric = Number.isFinite(target);
  const v = useCount(0, numeric ? target : 0);
  return (
    <span className="rl-bignum" aria-label={value}>
      {numeric ? Math.round(v) : value}
    </span>
  );
}

/** ספרות ענק: from ← to, עם ספירה יורדת (4b: 1.5% ← 0.8%). */
function CountDown({ from, to, suffix = "" }: { from: number; to: number; suffix?: string }) {
  const v = useCount(from, to, 2600, 900);
  const decimals = String(to).split(".")[1]?.length ?? 0;
  return (
    <div className="rl-countdown-pair" dir="ltr" aria-label={`${from}${suffix} ← ${to}${suffix}`}>
      <span className="rl-countdown-pair__from">
        {from}
        {suffix}
      </span>
      <svg className="rl-countdown-pair__arrow" viewBox="0 0 60 20" aria-hidden="true">
        <path d="M2 10 H56 M46 2 L56 10 L46 18" />
      </svg>
      <span className="rl-countdown-pair__to">
        {v.toFixed(decimals)}
        {suffix}
      </span>
    </div>
  );
}

/** שעון 30 שניות שיורד + מהדק בקו דק (שלב 3, שקף 1). */
function Countdown({ seconds, elapsedMs }: { seconds: number; elapsedMs: number }) {
  const left = Math.max(0, Math.ceil(seconds - elapsedMs / 1000));
  const frac = Math.min(1, elapsedMs / (seconds * 1000));
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="rl-timer" aria-label={`${left} שניות`}>
      <svg className="rl-clip" viewBox="0 0 60 140" aria-hidden="true">
        <path
          className="rl-draw"
          pathLength={1}
          d="M20 40 V112 A12 12 0 0 0 44 112 V22 A18 18 0 0 0 8 22 V118 A22 22 0 0 0 52 118 V52"
        />
      </svg>
      <div className="rl-timer__dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="rl-timer__track" />
          <circle
            cx="50"
            cy="50"
            r={R}
            className="rl-timer__arc"
            strokeDasharray={C}
            strokeDashoffset={C * frac}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="rl-timer__num">{left}</span>
      </div>
    </div>
  );
}

/** רשימה שמתארכת כלפי מטה; הפריטים האחרונים באדום (שלב 3, שקפים 2-3). */
function GrowingList() {
  const rows = 11;
  // אורכי שורות קבועים (לא אקראיים), כדי שהרשימה תיראה כמו כתב יד
  const widths = [62, 48, 70, 40, 56, 66, 44, 58, 72, 52, 64];
  return (
    <ol className="rl-list">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className={i >= rows - 3 ? "is-late" : undefined}
          style={{ animationDelay: `${0.4 + i * 0.75}s` }}
        >
          <span className="rl-list__n">{i + 1}</span>
          <span className="rl-list__bar" style={{ width: `${widths[i]}%` }} />
        </li>
      ))}
    </ol>
  );
}

/** ריבועים קטנים שמצטברים בהדרגה לצורה אחת גדולה (שלב 8, שקף 8). */
function Squares() {
  const n = 7;
  // סדר ההופעה: מהמרכז החוצה, כך שהצורה "גדלה" מתוך עצמה
  const cells = Array.from({ length: n * n }, (_, i) => {
    const x = i % n;
    const y = Math.floor(i / n);
    const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
    return { i, d: d * 10 + ((x * 7 + y * 3) % 10) };
  }).sort((a, b) => a.d - b.d);
  const order = new Map(cells.map((c, k) => [c.i, k]));
  return (
    <div className="rl-squares">
      {Array.from({ length: n * n }, (_, i) => (
        <span key={i} style={{ animationDelay: `${0.5 + (order.get(i) ?? 0) * 0.2}s` }} />
      ))}
    </div>
  );
}

/** חיצים מקדמים (כחול) מול בולמים (אדום) משני צידי קו (שלב 4, שקפים 5-7). */
function Forces({ released }: { released?: boolean }) {
  const ys = [22, 50, 78];
  const lineX = released ? 170 : 200;
  return (
    <svg className={`rl-forces${released ? " is-released" : ""}`} viewBox="0 0 400 100" aria-hidden="true">
      {/* מקדמים - מימין, דוחפים שמאלה (כיוון ההתקדמות ב-RTL) */}
      {ys.map((y, i) => (
        <g key={`p${i}`} className="rl-forces__push" style={{ animationDelay: `${0.3 + i * 0.2}s` }}>
          <path d={`M${370 - i * 14} ${y} H${lineX + 12} M${lineX + 24} ${y - 8} L${lineX + 12} ${y} L${lineX + 24} ${y + 8}`} />
        </g>
      ))}
      {/* בולמים - משמאל, דוחפים ימינה */}
      {ys.map((y, i) => (
        <g
          key={`r${i}`}
          className={`rl-forces__hold${released && i === 1 ? " is-gone" : ""}`}
          style={{ animationDelay: `${0.4 + i * 0.2}s` }}
        >
          <path d={`M${30 + i * 14} ${y} H${lineX - 12} M${lineX - 24} ${y - 8} L${lineX - 12} ${y} L${lineX - 24} ${y + 8}`} />
        </g>
      ))}
      <line className="rl-forces__line" x1={lineX} y1={4} x2={lineX} y2={96} />
    </svg>
  );
}

/** חיצים דקים שמתכנסים לנקודה אחת (שלב 5, שקפים 1-5: המבצר והקרינה). */
function Converge() {
  const cx = 200;
  const cy = 60;
  const starts: [number, number][] = [
    [20, 10], [10, 60], [20, 110], [380, 10], [390, 60], [380, 110], [200, 2],
  ];
  return (
    <svg className="rl-converge" viewBox="0 0 400 120" aria-hidden="true">
      {starts.map(([x, y], i) => {
        const dx = cx - x;
        const dy = cy - y;
        const len = Math.hypot(dx, dy);
        // עוצרים 14 יחידות לפני המרכז, ומוסיפים ראש חץ
        const ex = cx - (dx / len) * 14;
        const ey = cy - (dy / len) * 14;
        const ux = dx / len;
        const uy = dy / len;
        const h1x = ex - ux * 9 - uy * 5;
        const h1y = ey - uy * 9 + ux * 5;
        const h2x = ex - ux * 9 + uy * 5;
        const h2y = ey - uy * 9 - ux * 5;
        return (
          <path
            key={i}
            className="rl-draw"
            pathLength={1}
            style={{ animationDelay: `${0.3 + i * 0.12}s` }}
            d={`M${x} ${y} L${ex} ${ey} M${h1x} ${h1y} L${ex} ${ey} L${h2x} ${h2y}`}
          />
        );
      })}
      <circle className="rl-converge__target" cx={cx} cy={cy} r={7} />
    </svg>
  );
}

/** שני אייקונים בשני צידי המסך וקו ביניהם (שלב 5, "מה הקשר"). */
function LinkBand({ visual }: { visual: Extract<SlideVisual, { type: "link" }> }) {
  return (
    <div className={`rl-link${visual.solid ? " is-solid" : ""}`} aria-hidden="true">
      <LineIcon name={visual.a} className="rl-link__icon" />
      <span className="rl-link__line" />
      <LineIcon name={visual.b} className="rl-link__icon" />
    </div>
  );
}

/** חמש שורות שנחשפות אחת אחת כמדרגות יורדות; האחרונה באדום (שלב 6, שקף 7). */
function Stairs({ steps }: { steps: string[] }) {
  return (
    <ol className="rl-stairs">
      {steps.map((s, i) => (
        <li
          key={i}
          className={i === steps.length - 1 ? "is-last" : undefined}
          style={{ marginInlineStart: `${i * 2.4}vw`, animationDelay: `${0.6 + i * 1.6}s` }}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}

/** ציטוט עם מירכאות אדומות גדולות; המירכאות הישרות שבטקסט מוחלפות בהן. */
function QuoteText({ text }: { text: string }) {
  const m = text.match(/^(.*?)"(.+)"\s*$/);
  if (!m) return <p className="rl-quote">{text}</p>;
  return (
    <p className="rl-quote">
      {m[1] && <span className="rl-quote__pre">{m[1]}</span>}
      {m[2]}
      <span className="rl-quote__close" aria-hidden="true">
        ״
      </span>
    </p>
  );
}

/** מחוון התקדמות מעגלי שמתמלא עם התקדמות הלופ (שלב 6). */
function ProgressRing({ value }: { value: number }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  return (
    <svg className="rl-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={R} className="rl-ring__track" />
      <circle
        cx="50"
        cy="50"
        r={R}
        className="rl-ring__arc"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - value)}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

/* --- אייקונים קוויים (viewBox 64) --------------------------------------- */
const ICONS: Record<IconName, string[]> = {
  // שלדג: גוף, מקור ארוך, כנף
  bird: [
    "M40 30 L62 33 L40 37",
    "M40 30 Q36 20 28 22 Q20 24 20 34 Q18 46 8 52 Q22 52 30 46 Q40 42 40 37",
    "M22 38 Q28 34 34 40",
    "M31 28 h0.1",
  ],
  // חרטום רכבת השינקנסן
  train: ["M4 44 H38 Q58 44 61 36 Q52 24 30 24 H4", "M28 30 H46", "M2 54 H62", "M14 44 V50 M34 44 V50"],
  // ראש כלב עם אוזניים שמוטות
  // ראש כלב בפרופיל: חוטם, אוזן שמוטה, עין ואף
  dog: [
    "M14 28 Q18 14 34 18 L52 26 Q58 30 54 36 L38 38 Q34 48 22 46 Q12 42 14 28 Z",
    "M24 20 Q14 30 21 42",
    "M36 26 h0.1",
    "M54 31 h0.1",
  ],
  // נעל עם רצועות סקוץ'
  shoe: ["M6 46 V22 H20 Q24 32 36 34 L54 38 Q62 40 60 46 Z", "M16 30 H26 M18 36 H30", "M6 46 H60"],
  // מכונית מרוץ
  car: ["M4 42 L12 34 L28 32 L36 24 H48 L52 32 L62 34 V42 Z", "M10 46 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0", "M46 46 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0"],
  // בית חולים עם צלב
  hospital: ["M12 56 V14 H52 V56 Z", "M32 22 V38 M24 30 H40", "M26 56 V46 H38 V56", "M6 56 H58"],
  // פרה־מורטם: שעון עם חץ אחורה
  premortem: ["M32 12 A20 20 0 1 1 13 26", "M8 16 L13 26 L23 22", "M32 22 V32 L40 38"],
  // חמש פעמים "למה": סימן שאלה מעל מדרגות
  whys: ["M24 20 Q24 10 32 10 Q40 10 40 18 Q40 24 32 27 V33", "M32 39 h0.1", "M8 56 H20 V50 H32 V44 H44 V38 H56"],
  // כובע
  hats: ["M12 40 Q32 48 52 40", "M20 40 Q20 18 32 18 Q44 18 44 40", "M20 34 Q32 38 44 34"],
  // מנוף על נקודת משען
  lever: ["M6 22 L58 44", "M30 46 L36 34 L42 46 Z", "M6 22 V14 H14 V25"],
  // מעגל PDCA: שני חיצים מעגליים
  cycle: ["M50 26 A20 20 0 0 0 14 28", "M14 38 A20 20 0 0 0 50 36", "M44 22 L50 26 L52 18", "M20 42 L14 38 L12 46"],
};

function LineIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={`rl-icon ${className ?? ""}`} viewBox="0 0 64 64" aria-hidden="true">
      {ICONS[name].map((d, i) => (
        <path key={i} className="rl-draw" pathLength={1} d={d} style={{ animationDelay: `${0.3 + i * 0.25}s` }} />
      ))}
    </svg>
  );
}

/* ==========================================================================
   רקעי לופ
   ========================================================================== */
function LoopBg({ type, step, total }: { type: LoopBackground; step: number; total: number }) {
  if (type === "network") return <NetworkBackground />;
  if (type === "branches") return <BranchesBackground step={step} total={total} />;
  return <FractalZoomBackground />;
}

/** רקע "רשת": עיגולים קטנים (חברות הקבוצה) מחוברים בקווים דקים. */
const NET_NODES: [number, number][] = [
  [6, 18], [18, 9], [27, 26], [12, 40], [4, 62], [17, 74], [29, 58], [24, 90],
  [94, 14], [83, 24], [72, 12], [90, 40], [78, 50], [96, 66], [86, 80], [73, 92],
];
const NET_EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 3], [2, 3], [3, 4], [4, 5], [5, 6], [3, 6], [5, 7], [6, 7],
  [8, 9], [9, 10], [8, 11], [9, 11], [11, 12], [12, 13], [11, 13], [13, 14], [14, 15], [12, 14],
];
function NetworkBackground() {
  return (
    // קואורדינטות באחוזים בלי viewBox - כך העיגולים נשארים עגולים בכל יחס מסך
    <svg className="rl-net" aria-hidden="true">
      {NET_EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={`${NET_NODES[a][0]}%`}
          y1={`${NET_NODES[a][1]}%`}
          x2={`${NET_NODES[b][0]}%`}
          y2={`${NET_NODES[b][1]}%`}
        />
      ))}
      {NET_NODES.map(([x, y], i) => (
        <circle key={i} cx={`${x}%`} cy={`${y}%`} r={9} style={{ animationDelay: `${(i % 8) * 0.6}s` }} />
      ))}
    </svg>
  );
}

/**
 * רקע "ענפים": קווים שמסתעפים מגזע אחד, ומתווספים משקף לשקף (שלב 3).
 * העץ נבנה פעם אחת (דטרמיניסטי); בכל שקף נחשפת עוד "קומה" של ענפים.
 */
interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
}
const BRANCH_DEPTH = 8;
const BRANCHES: Seg[] = (() => {
  const out: Seg[] = [];
  const grow = (x: number, y: number, angle: number, len: number, depth: number, seed: number) => {
    if (depth >= BRANCH_DEPTH) return;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    out.push({ x1: x, y1: y, x2, y2, depth });
    const wobble = ((seed * 37) % 11) / 100;
    grow(x2, y2, angle - 0.42 - wobble, len * 0.76, depth + 1, seed * 2 + 1);
    grow(x2, y2, angle + 0.36 + wobble, len * 0.72, depth + 1, seed * 2 + 2);
  };
  grow(1180, 900, -Math.PI / 2 - 0.12, 190, 0, 1);
  return out;
})();
function BranchesBackground({ step, total }: { step: number; total: number }) {
  // קומה נוספת בכל שקף; בסוף הלופ (שקף הסיום) העץ מלא
  const shown = Math.max(1, Math.round(((step + 1) / Math.max(1, total - 1)) * BRANCH_DEPTH));
  return (
    <svg className="rl-branches" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {BRANCHES.map((s, i) =>
        s.depth < shown ? (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            className={s.depth === shown - 1 ? "is-new" : undefined}
            style={{ strokeWidth: Math.max(1, 4 - s.depth * 0.45) }}
          />
        ) : null,
      )}
    </svg>
  );
}

/**
 * רקע "זום פרקטלי": ריבועים מקוננים, כל אחד קטן פי 0.82 ומסובב 8° מהקודם.
 * האנימציה מגדילה פי 1/0.82 ומסובבת 8°- - בדיוק צעד אחד בסדרה - ולכן
 * החזרה להתחלה בלתי נראית: זום אינסופי לתוך אותה צורה (שלב 8).
 */
function FractalZoomBackground() {
  // הריבוע החיצוני גדול מהמסך תמיד, כדי שהקפיצה בסוף המחזור לא תיראה
  const n = 30;
  return (
    <div className="rl-fzoom" aria-hidden="true">
      <svg viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid slice">
        <g className="rl-fzoom__spin">
          {Array.from({ length: n }, (_, i) => {
            const s = 3000 * Math.pow(0.82, i);
            return (
              <rect
                key={i}
                x={-s / 2}
                y={-s / 2}
                width={s}
                height={s}
                transform={`rotate(${i * 8})`}
                vectorEffect="non-scaling-stroke"
                className={i % 4 === 3 ? "is-accent" : undefined}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default RoomLoop;
