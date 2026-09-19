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

const STROKE_COLOR: Record<"green" | "red", string> = {
  green: "#3ba35a",
  red: "#c9463f",
};
const STROKE_WIDTH = 30;
const STROKE_ALPHA = 0.6;

/** כפתור בצורת מרקר אמיתי - פקק, גוף עם השם כתוב עליו לאורך, וחוד. */
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
      className={`flex flex-col items-center transition-transform active:scale-95 ${active ? "-translate-y-2" : ""}`}
      onClick={onClick}
    >
      <div className={`h-5 w-9 rounded-t-md border-2 border-black/30 ${capClass}`} />
      <div
        className={`flex h-20 w-9 items-center justify-center border-2 border-black/30 text-[11px] font-bold text-white/90 ${bodyClass}`}
        style={{ writingMode: "vertical-rl" }}
      >
        {label}
      </div>
      <div className={`h-4 w-7 ${bodyClass}`} style={{ clipPath: "polygon(50% 100%, 15% 0, 85% 0)" }} />
      <div className={`mt-2 h-1 w-8 rounded-full ${active ? "bg-white" : "bg-transparent"}`} />
    </button>
  );
}

/** כפתור מחק בצורת מחק עיפרון קלאסי. */
function EraserTool({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex flex-col items-center transition-transform active:scale-95 ${active ? "-translate-y-2" : ""}`}
      onClick={onClick}
    >
      <div className="h-11 w-16 rounded-md border-2 border-black/30 bg-linear-to-b from-pink-300 to-pink-100" />
      <span className="mt-1 text-xs font-bold">מחק</span>
      <div className={`mt-1 h-1 w-8 rounded-full ${active ? "bg-white" : "bg-transparent"}`} />
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
 * הצביעה בפועל היא ציור freehand על canvas שקוף שיושב מעל הטקסט, עם
 * mix-blend-mode: multiply (בדיוק כמו מרקר אמיתי על דף - הצבע נספג ב"נייר"
 * והטקסט מתחתיו נשאר קריא) - לא עוד צביעת רקע דיסקרטית של כל מילה בנפרד.
 * ה"נייר" הלבן מתחת חיוני לאפקט: multiply על רקע כהה היה יוצא עכור, לא בהיר.
 * הנתון שנשמר עדיין ברמת מילה שלמה (marks[i]) כי זה מה שצריך לשלבים הבאים
 * (למשל טבלת הסנכרון); ה-canvas רק מצייר, ומשוחזר מ-marks בכל טעינה מחדש.
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
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = STROKE_ALPHA;
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

  /** מושכת קו חלק (round cap/join) בין שתי נקודות - זה מה שהופך גרירה מהירה לקו רציף במקום נקודות מרוסקות. */
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
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = STROKE_ALPHA;
      ctx.strokeStyle = STROKE_COLOR[tool];
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

  function updateWordAt(clientX: number, clientY: number, tool: Tool) {
    const el = document.elementFromPoint(clientX, clientY);
    const indexAttr = el?.closest<HTMLElement>("[data-word-index]")?.dataset.wordIndex;
    if (indexAttr === undefined) return;
    const index = Number(indexAttr);
    if (lastWordIndexRef.current === index) return;
    lastWordIndexRef.current = index;
    markWord(index, tool === "eraser" ? null : tool);
  }

  function handlePaperPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true;
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">ניתוח דילמה</h1>

      <div className="fixed top-6 left-6 max-w-xs rounded-xl bg-white/10 px-4 py-3 text-sm">
        <p className="mb-2 font-bold">4 ההשראות המובילות</p>
        {top.length === 0 ? (
          <p className="text-white/50">עדיין לא נבחרו השראות אצל אף קבוצה</p>
        ) : (
          <ol className="list-decimal space-y-1 pr-4">
            {top.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ol>
        )}
      </div>

      <p className="max-w-lg text-center text-sm text-white/60">
        סמנו את הטקסט בגרירה, כמו במרקר אמיתי על דף.
      </p>

      <div className="flex items-end gap-6">
        <MarkerTool tool="green" label="חוזקות" active={activeTool === "green"} onClick={() => setActiveTool("green")} />
        <MarkerTool tool="red" label="חסמים" active={activeTool === "red"} onClick={() => setActiveTool("red")} />
        <EraserTool active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} />
      </div>

      <div
        ref={paperRef}
        className="relative max-w-2xl rounded-2xl p-8 shadow-2xl"
        style={{ background: "linear-gradient(180deg, #fbf8f1 0%, #f3ede0 100%)", touchAction: "none" }}
        onPointerDown={handlePaperPointerDown}
        onPointerMove={handlePaperPointerMove}
      >
        <p className="relative text-xl leading-loose text-[#2b2620] select-none">
          {words.map((word, i) => (
            <span key={i}>
              <span data-word-index={i} className="inline-block cursor-pointer px-0.5">
                {word}
              </span>{" "}
            </span>
          ))}
        </p>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} />
      </div>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold transition-transform duration-100 active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

export default Stage4Analysis;
