import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Group } from "../../types/group";
import type { Stage4Content } from "../../types/stage4Content";
import { useTopInspirations } from "../../hooks/useTopInspirations";
import { useTextMarking, type MarkColor } from "../../hooks/useTextMarking";

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage4Content;
  onAdvance: () => void;
}

type Tool = "green" | "red" | "eraser";

// צבעי דיו רכים וטבעיים - כמו מרקר אמיתי על נייר, לא ירוק/אדום רוויים
// וחדים. כפתורי הכלים עצמם (MarkerTool) נשארים בצבע בולט יותר לזיהוי נוח,
// אבל מה שנצבע בפועל על הדף רך יותר לעין.
const STROKE_COLOR: Record<"green" | "red", string> = {
  green: "#7fb069",
  red: "#d9776a",
};
const STROKE_WIDTH = 40;
const STROKE_ALPHA = 0.65;
// טשטוש עדין בקצוות המשיכה - כמו קצה לבד רך של מרקר אמיתי, לא צורת וקטור
// גיאומטרית חדה. אם הדפדפן לא תומך ב-ctx.filter (מסך ישן) הוא פשוט מתעלם
// ממנו ומצייר בלי טשטוש - לא נשבר, רק פחות רך.
const STROKE_BLUR_PX = 2.5;
// סלחנות למגע לא מדויק - רדיוס בפיקסלים מסביב למילה שעדיין "תופס" אותה, כי
// אצבע אמיתית על מסך ענק אף פעם לא נוגעת בול במרכז המילה (בשונה מעכבר).
const TOUCH_TOLERANCE_PX = 28;

/** כפתור בצורת מרקר אמיתי - פקק, גוף עם השם כתוב עליו לאורך, וחוד, עם צל רך שנותן תחושת עומק. */
function MarkerTool({
  tool,
  label,
  active,
  onClick,
}: {
  tool: "green" | "red";
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const bodyClass = tool === "green" ? "bg-green-700" : "bg-accent-red";
  const capClass = tool === "green" ? "bg-green-900" : "bg-red-950";
  return (
    <button
      // padding מסביב לצורה עצמה - מגדיל את שטח הנגיעה בפועל בלי לנפח חזותית את הציור.
      className={`group flex flex-col items-center rounded-2xl p-3 transition-all duration-200 active:scale-95 ${
        active ? "-translate-y-3 bg-white/10" : "hover:-translate-y-1 hover:bg-white/5"
      }`}
      onClick={onClick}
    >
      <div
        className={`h-6 w-12 rounded-t-md border-2 border-black/30 ${capClass} transition-shadow ${
          active ? "shadow-[0_0_18px_rgba(255,255,255,0.35)]" : ""
        }`}
      />
      <div
        className={`flex h-24 w-12 items-center justify-center border-2 border-black/30 text-sm font-bold text-white/90 ${bodyClass}`}
        style={{ writingMode: "vertical-rl" }}
      >
        {label}
      </div>
      <div className={`h-5 w-9 ${bodyClass}`} style={{ clipPath: "polygon(50% 100%, 15% 0, 85% 0)" }} />
      <div
        className={`mt-3 h-1.5 w-12 rounded-full transition-all duration-200 ${
          active ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" : "bg-transparent"
        }`}
      />
    </button>
  );
}

/** כפתור מחק בצורת מחק עיפרון קלאסי. */
function EraserTool({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      className={`group flex flex-col items-center rounded-2xl p-3 transition-all duration-200 active:scale-95 ${
        active ? "-translate-y-3 bg-white/10" : "hover:-translate-y-1 hover:bg-white/5"
      }`}
      onClick={onClick}
    >
      <div
        className={`h-16 w-20 rounded-md border-2 border-black/30 bg-linear-to-b from-pink-300 to-pink-100 transition-shadow ${
          active ? "shadow-[0_0_18px_rgba(255,255,255,0.35)]" : ""
        }`}
      />
      <span className="mt-2 text-sm font-bold">מחק</span>
      <div
        className={`mt-2 h-1.5 w-12 rounded-full transition-all duration-200 ${
          active ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" : "bg-transparent"
        }`}
      />
    </button>
  );
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * שלב 4 - ניתוח דילמה (שקף 6 במצגת, החלק הראשון בלבד - בלי טבלת הסנכרון
 * האוטומטית ותמונת התפקוד ב-AI משקף 7, שנבנים בנפרד בהמשך).
 *
 * שני חלקים: (1) תיבה למעלה עם 4 ההשראות שנבחרו הכי הרבה בסך הכל אצל כל
 * הקבוצות בשלב 3 (useTopInspirations); (2) טקסט פרופיל (עדיין placeholder -
 * התוכן האמיתי יגיע מהלקוחה) שכל קבוצה מסמנת בעצמה בגרירה - ירוק לחוזקות,
 * אדום לחסמים, עם כלי מחק נפרד (לפי ההחלטה בסעיף 12 ב-CLAUDE.md: סימון
 * מילה-מילה בגרירה, לא בחירת התחלה/סוף).
 *
 * הצביעה בפועל היא ציור freehand על canvas שקוף שיושב מעל הטקסט, בצבע
 * מרקר עם שקיפות (לא צבע מלא) כדי שהטקסט מתחתיו יישאר קריא - לא עוד צביעת
 * רקע דיסקרטית של כל מילה בנפרד. חשוב: הציור עצמו הוא source-over רגיל,
 * לא multiply - ראו הסבר מפורט ליד strokeTo (multiply-על-canvas גרם לסימון
 * להכהות עד שחור כשחוזרים על אותו מקום, למשל בנגיעה בודדת בלי גרירה).
 * הנתון שנשמר עדיין ברמת מילה שלמה (marks[i]) כי זה מה שצריך לשלבים הבאים
 * (למשל טבלת הסנכרון); ה-canvas רק מצייר, ומשוחזר מ-marks בכל טעינה מחדש.
 *
 * נגישות למגע: זיהוי איזו מילה האצבע "מסמנת" לא מתבסס על פגיעה פיקסלית
 * מדויקת (document.elementFromPoint) אלא על המילה הקרובה ביותר בתוך רדיוס
 * סלחני (TOUCH_TOLERANCE_PX) - אצבע אמיתית על מסך ענק כמעט אף פעם לא נוגעת
 * בול במרכז מילה קצרה. רשימת מיקומי המילים נמדדת פעם אחת בתחילת כל גרירה
 * (cacheWordRects) ולא בכל תזוזה, כי המדידה (getBoundingClientRect) יקרה
 * יותר מהחישוב הגיאומטרי עצמו והטקסט לא זז באמצע סימון.
 */
function Stage4Analysis({ workshopId, myGroup, content, onAdvance }: Props) {
  const { top, loading: loadingTop } = useTopInspirations(workshopId);
  const { marks, loading: loadingMarks, mutate } = useTextMarking(workshopId, myGroup.id);
  const [activeTool, setActiveTool] = useState<Tool>("green");
  const marksRef = useRef<MarkColor[]>([]);
  const isDraggingRef = useRef(false);
  const activeToolRef = useRef<Tool>("green");
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastWordIndexRef = useRef<number | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRectsRef = useRef<{ index: number; rect: DOMRect }[]>([]);

  const words = useMemo(() => content.profile_text.split(/\s+/).filter(Boolean), [content.profile_text]);
  const loading = loadingTop || loadingMarks;

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  function getContext() {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d") ?? null;
  }

  /** מכינה את הרזולוציה הפנימית של ה-canvas לפי גודל התיבה בפועל ו-DPR, כדי שהקו ייצא חד גם על מסך מגע בחדות גבוהה. */
  function setupCanvas() {
    const canvas = canvasRef.current;
    const paper = paperRef.current;
    if (!canvas || !paper) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = paper.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** מציירת מחדש את כל הסימונים לפי marks[] - קירוב מלבני חלק לכל מילה מסומנת, כי הציור החופשי המקורי לא נשמר, רק אילו מילים סומנו. */
  function redrawFromMarks(marksArray: MarkColor[]) {
    const ctx = getContext();
    const paper = paperRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !paper || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // source-over ולא multiply: שני מלבנים סמוכים שנוגעים קצת אחד בשני לא
    // אמורים "להכפיל" זה על זה ולהכהות - ראו הסבר מלא ליד strokeTo למטה.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = STROKE_ALPHA;
    ctx.filter = `blur(${STROKE_BLUR_PX}px)`;
    const paperRect = paper.getBoundingClientRect();
    marksArray.forEach((color, i) => {
      if (!color) return;
      const wordEl = paper.querySelector<HTMLElement>(`[data-word-index="${i}"]`);
      if (!wordEl) return;
      const r = wordEl.getBoundingClientRect();
      ctx.fillStyle = STROKE_COLOR[color];
      roundRectPath(
        ctx,
        r.left - paperRect.left - 4,
        r.top - paperRect.top + r.height * 0.12,
        r.width + 8,
        r.height * 0.76,
        8,
      );
      ctx.fill();
    });
    ctx.restore();
  }

  // מסתנכרן מהשרת רק כשלא באמצע גרירה - כדי לא לדרוס סימון שעדיין לא נשמר.
  useEffect(() => {
    if (!isDraggingRef.current) {
      marksRef.current = marks;
      // מחכה לפריים הבא כדי שה-DOM של המילים כבר יהיה בגודל הסופי לפני שממדדים אותו.
      requestAnimationFrame(() => redrawFromMarks(marks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  // תלוי ב-loading בכוונה, לא ב-[]: בזמן הטעינה עדיין אין canvas/paper ב-DOM
  // בכלל (התצוגה שם היא "טוענת..."), אז effect עם [] היה נתפס לרגע ההוא -
  // ה-refs עדיין null אז setupCanvas היה עושה כלום, ובלי תלות זה לא היה
  // רץ שוב אף פעם. ברגע ש-loading הופך false, האלמנטים כבר קיימים באמת.
  useEffect(() => {
    if (loading) return;
    setupCanvas();
    redrawFromMarks(marksRef.current);
    function handleResize() {
      setupCanvas();
      redrawFromMarks(marksRef.current);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    function handleWindowPointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      lastPointRef.current = null;
      lastWordIndexRef.current = null;
      const snapshot = marksRef.current;
      mutate(() => snapshot);
    }
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markWord(index: number, color: MarkColor) {
    const next = marksRef.current.slice();
    next[index] = color;
    marksRef.current = next;
  }

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /**
   * מושכת קו חלק (round cap/join) בין שתי נקודות - זה מה שהופך גרירה מהירה
   * לקו רציף במקום נקודות מרוסקות.
   *
   * שימו לב: source-over ולא multiply. multiply על ה-canvas עצמו (לא כמו
   * mix-blend-mode ב-CSS) מכפיל כל משיכה חדשה בפיקסלים שכבר צוירו *על אותו
   * canvas* - כשנוגעים פעם אחת בלי כמעט לזוז, כל תזוזת עכבר/אצבע קטנה גוררת
   * ctx.arc נוסף בערך על אותה נקודה, וכל "מכפלה" כזו מכהה עוד קצת, עד שהצבע
   * מתכנס לשחור. source-over עם שקיפות פשוט מתכנס לצבע המרקר המלא כשחוזרים
   * על אותו מקום - בדיוק ההתנהגות שמצפים לה ממרקר אמיתי, לא הכהיה.
   */
  function strokeTo(from: { x: number; y: number }, to: { x: number; y: number }, tool: Tool) {
    const ctx = getContext();
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = STROKE_WIDTH;
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#000000";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = STROKE_ALPHA;
      ctx.strokeStyle = STROKE_COLOR[tool];
      // רק בצביעה, לא במחיקה - קצה רך כמו לבד של מרקר אמיתי. במחיקה קצה
      // מטושטש היה משאיר "רוח רפאים" דהויה של הצבע במקום למחוק אותו נקי.
      ctx.filter = `blur(${STROKE_BLUR_PX}px)`;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    // נקודה עגולה גם בתחילת המשיכה, כדי שנגיעה בודדת (בלי תזוזה) תשאיר סימון עגול, לא כלום.
    ctx.beginPath();
    ctx.arc(to.x, to.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** ממדדת את כל המילים פעם אחת בתחילת הגרירה - זול יותר מלמדוד מחדש בכל תזוזה, ומספיק כי הטקסט לא זז תוך כדי סימון. */
  function cacheWordRects() {
    const paper = paperRef.current;
    if (!paper) return;
    const elements = paper.querySelectorAll<HTMLElement>("[data-word-index]");
    wordRectsRef.current = Array.from(elements).map((el) => ({
      index: Number(el.dataset.wordIndex),
      rect: el.getBoundingClientRect(),
    }));
  }

  /**
   * מוצאת את המילה הקרובה ביותר לנקודת המגע, לא רק מילה שנוגעים בה בול -
   * זו הנגישות האמיתית פה: אצבע על מסך ענק כמעט אף פעם לא מדויקת פיקסל-פיקסל,
   * אז מרחק עד TOUCH_TOLERANCE_PX מהמילה עדיין "תופס" אותה כאילו נגעו בה.
   */
  function nearestWordAt(clientX: number, clientY: number): number | null {
    let bestIndex: number | null = null;
    let bestDist = Infinity;
    for (const { index, rect } of wordRectsRef.current) {
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    }
    return bestDist <= TOUCH_TOLERANCE_PX ? bestIndex : null;
  }

  function updateWordAt(clientX: number, clientY: number, tool: Tool) {
    const index = nearestWordAt(clientX, clientY);
    if (index === null) return;
    if (lastWordIndexRef.current === index) return;
    lastWordIndexRef.current = index;
    markWord(index, tool === "eraser" ? null : tool);
  }

  function handlePaperPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true;
    cacheWordRects();
    const point = canvasPoint(e.clientX, e.clientY);
    lastPointRef.current = point;
    const tool = activeToolRef.current;
    strokeTo(point, point, tool);
    lastWordIndexRef.current = null;
    updateWordAt(e.clientX, e.clientY, tool);
  }

  function handlePaperPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const point = canvasPoint(e.clientX, e.clientY);
    const tool = activeToolRef.current;
    if (lastPointRef.current) strokeTo(lastPointRef.current, point, tool);
    lastPointRef.current = point;
    updateWordAt(e.clientX, e.clientY, tool);
  }

  const pageBackground = {
    background:
      "radial-gradient(circle at 50% 15%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 45%, var(--color-smoke-blue-darker) 100%)",
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={pageBackground}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-wood-light" />
          <p className="text-xl text-white/80">טוענת...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-7 p-8" style={pageBackground}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold tracking-tight">ניתוח דילמה</h1>
        <p className="text-sm text-white/50">שקף 6 - זיהוי חוזקות וחסמים</p>
      </div>

      <div className="fixed top-6 left-6 w-64 rounded-2xl border border-wood/30 bg-smoke-blue-darker/80 p-4 shadow-xl backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
          <span className="text-xl">🏆</span>
          <p className="font-bold">4 ההשראות המובילות</p>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-white/50">עדיין לא נבחרו השראות אצל אף קבוצה</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {top.map((text, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wood text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="truncate">{text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="rounded-full bg-white/5 px-5 py-2 text-sm text-white/70">
        ✏️ סמנו את הטקסט בגרירה, כמו במרקר אמיתי על דף
      </p>

      <div className="flex items-end gap-10 rounded-2xl bg-black/15 px-8 py-5 shadow-inner shadow-black/30">
        <MarkerTool tool="green" label="חוזקות" active={activeTool === "green"} onClick={() => setActiveTool("green")} />
        <MarkerTool tool="red" label="חסמים" active={activeTool === "red"} onClick={() => setActiveTool("red")} />
        <EraserTool active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} />
      </div>

      <div
        ref={paperRef}
        className="relative w-full max-w-2xl rounded-3xl p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.55)]"
        style={{ background: "linear-gradient(180deg, #fdfbf5 0%, #f3ede0 100%)", touchAction: "none" }}
        onPointerDown={handlePaperPointerDown}
        onPointerMove={handlePaperPointerMove}
      >
        <p className="relative text-2xl leading-loose text-[#2b2620] select-none">
          {words.map((word, i) => (
            <span key={i}>
              <span data-word-index={i} className="inline-block cursor-pointer px-0.5 py-0.5">
                {word}
              </span>{" "}
            </span>
          ))}
        </p>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} />
      </div>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark flex items-center gap-2 rounded-xl px-10 py-5 text-xl font-bold shadow-lg shadow-black/30 transition-transform duration-100 hover:-translate-y-0.5 active:scale-90"
        onClick={onAdvance}
      >
        הבא
        <span aria-hidden="true">←</span>
      </button>
    </main>
  );
}

export default Stage4Analysis;
