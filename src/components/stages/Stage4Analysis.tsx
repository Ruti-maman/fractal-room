import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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

const MARK_CLASS: Record<"green" | "red", string> = {
  green: "bg-green-700/70",
  red: "bg-accent-red/70",
};

const BRUSH_COLOR: Record<Tool, string> = {
  green: "#15803d",
  red: "#b23a3a",
  eraser: "#e5e7eb",
};

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
      <div
        className={`h-4 w-7 ${bodyClass}`}
        style={{ clipPath: "polygon(50% 100%, 15% 0, 85% 0)" }}
      />
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
 * תחושת "צביעה" - כדור מכחול קטן עוקב אחרי האצבע, וכל מילה מקבלת מעבר צבע
 * חלק (לא קפיצה חדה) ברגע שהברוש עובר מעליה, כדי שהגרירה הרציפה על פני כמה
 * מילים תרגיש כמו משיכת מרקר אחת, לא כמו כמה לחיצות נפרדות.
 */
function Stage4Analysis({ workshopId, myGroup, content, onAdvance }: Props) {
  const { top, loading: loadingTop } = useTopInspirations(workshopId);
  const { marks, loading: loadingMarks, mutate } = useTextMarking(workshopId, myGroup.id);
  const [activeTool, setActiveTool] = useState<Tool>("green");
  const [localMarks, setLocalMarks] = useState<MarkColor[]>([]);
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);
  const marksRef = useRef<MarkColor[]>([]);
  const isDraggingRef = useRef(false);
  const activeToolRef = useRef<Tool>("green");

  const words = useMemo(() => content.profile_text.split(/\s+/).filter(Boolean), [content.profile_text]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // מסתנכרן מהשרת רק כשלא באמצע גרירה - כדי לא לדרוס סימון שעדיין לא נשמר.
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalMarks(marks);
      marksRef.current = marks;
    }
  }, [marks]);

  useEffect(() => {
    function handleWindowPointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setBrushPos(null);
      const snapshot = marksRef.current;
      mutate(() => snapshot);
    }
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paintWord(index: number, color: MarkColor) {
    const next = marksRef.current.slice();
    next[index] = color;
    marksRef.current = next;
    setLocalMarks(next);
  }

  function colorForTool(tool: Tool): MarkColor {
    return tool === "eraser" ? null : tool;
  }

  function handleWordPointerDown(index: number, clientX: number, clientY: number) {
    isDraggingRef.current = true;
    setBrushPos({ x: clientX, y: clientY });
    const current = marksRef.current[index];
    const color = colorForTool(activeToolRef.current);
    // נגיעה בודדת (לא גרירה) על מילה שכבר בצבע הפעיל - מנקה אותה, כמו מחק.
    paintWord(index, current === color && color !== null ? null : color);
  }

  // מגע (touch) לא מפעיל pointerenter על אלמנטים שהאצבע עוברת מעליהם - כל
  // אירועי ה-pointer נשארים "שבויים" באלמנט שבו התחילה הנגיעה. לכן בודקים
  // איפה האצבע נמצאת עכשיו לפי קואורדינטות, ולא סומכים על pointerenter.
  function handleContainerPointerMove(e: PointerEvent<HTMLParagraphElement>) {
    if (!isDraggingRef.current) return;
    setBrushPos({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const indexAttr = el?.closest<HTMLElement>("[data-word-index]")?.dataset.wordIndex;
    if (indexAttr === undefined) return;
    paintWord(Number(indexAttr), colorForTool(activeToolRef.current));
  }

  const loading = loadingTop || loadingMarks;

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
        סמנו את הטקסט בגרירה, כמו במרקר אמיתי.
      </p>

      <div className="flex items-end gap-6">
        <MarkerTool tool="green" label="חוזקות" active={activeTool === "green"} onClick={() => setActiveTool("green")} />
        <MarkerTool tool="red" label="חסמים" active={activeTool === "red"} onClick={() => setActiveTool("red")} />
        <EraserTool active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} />
      </div>

      <p
        className="max-w-2xl text-xl leading-loose select-none"
        style={{ touchAction: "none" }}
        onPointerMove={handleContainerPointerMove}
      >
        {words.map((word, i) => (
          <span key={i}>
            <span
              data-word-index={i}
              className={`inline-block cursor-pointer rounded px-1 transition-colors duration-150 ease-out ${
                localMarks[i] === "green" ? MARK_CLASS.green : localMarks[i] === "red" ? MARK_CLASS.red : ""
              }`}
              onPointerDown={(e) => handleWordPointerDown(i, e.clientX, e.clientY)}
            >
              {word}
            </span>{" "}
          </span>
        ))}
      </p>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold transition-transform duration-100 active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>

      {brushPos && (
        <div
          className="pointer-events-none fixed z-50 rounded-full border-2 border-white/70"
          style={{
            left: brushPos.x,
            top: brushPos.y,
            width: 22,
            height: 22,
            transform: "translate(-50%, -50%)",
            backgroundColor: BRUSH_COLOR[activeTool],
            boxShadow: "0 0 8px rgba(0,0,0,0.5)",
          }}
        />
      )}
    </main>
  );
}

export default Stage4Analysis;
