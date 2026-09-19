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

const MARK_CLASS: Record<"green" | "red", string> = {
  green: "bg-green-700/70",
  red: "bg-accent-red/70",
};

/**
 * שלב 4 - ניתוח דילמה (שקף 6 במצגת, החלק הראשון בלבד - בלי טבלת הסנכרון
 * האוטומטית ותמונת התפקוד ב-AI משקף 7, שנבנים בנפרד בהמשך).
 *
 * שני חלקים: (1) תיבה למעלה עם 4 ההשראות שנבחרו הכי הרבה בסך הכל אצל כל
 * הקבוצות בשלב 3 (useTopInspirations - צירוף חוצה-קבוצות); (2) טקסט פרופיל
 * שכל קבוצה מסמנת בעצמה בגרירה - ירוק לחוזקות, אדום לחסמים (לפי ההחלטה
 * בסעיף 12 ב-CLAUDE.md: סימון מילה-מילה בגרירה, לא בחירת התחלה/סוף).
 */
function Stage4Analysis({ workshopId, myGroup, content, onAdvance }: Props) {
  const { top, loading: loadingTop } = useTopInspirations(workshopId);
  const { marks, loading: loadingMarks, mutate } = useTextMarking(workshopId, myGroup.id);
  const [activeColor, setActiveColor] = useState<"green" | "red">("green");
  const [localMarks, setLocalMarks] = useState<MarkColor[]>([]);
  const marksRef = useRef<MarkColor[]>([]);
  const isDraggingRef = useRef(false);

  const words = useMemo(() => content.profile_text.split(/\s+/).filter(Boolean), [content.profile_text]);

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

  function handleWordPointerDown(index: number) {
    isDraggingRef.current = true;
    const current = marksRef.current[index];
    // נגיעה בודדת (לא גרירה) על מילה שכבר בצבע הפעיל - מנקה אותה, כמו מחק.
    paintWord(index, current === activeColor ? null : activeColor);
  }

  // מגע (touch) לא מפעיל pointerenter על אלמנטים שהאצבע עוברת מעליהם - כל
  // אירועי ה-pointer נשארים "שבויים" באלמנט שבו התחילה הנגיעה. לכן בודקים
  // איפה האצבע נמצאת עכשיו לפי קואורדינטות, ולא סומכים על pointerenter.
  function handleContainerPointerMove(e: PointerEvent<HTMLParagraphElement>) {
    if (!isDraggingRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const indexAttr = el?.closest<HTMLElement>("[data-word-index]")?.dataset.wordIndex;
    if (indexAttr !== undefined) paintWord(Number(indexAttr), activeColor);
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
        סמנו את הטקסט בגרירה: ירוק לחוזקות, אדום לחסמים.
      </p>

      <div className="flex gap-4">
        <button
          className={`rounded-xl px-6 py-4 text-lg font-bold transition-transform active:scale-90 ${
            activeColor === "green" ? "bg-green-700 ring-4 ring-white" : "bg-green-700/50"
          }`}
          onClick={() => setActiveColor("green")}
        >
          ירוק = חוזקות
        </button>
        <button
          className={`rounded-xl px-6 py-4 text-lg font-bold transition-transform active:scale-90 ${
            activeColor === "red" ? "bg-accent-red ring-4 ring-white" : "bg-accent-red/50"
          }`}
          onClick={() => setActiveColor("red")}
        >
          אדום = חסמים
        </button>
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
              className={`inline-block cursor-pointer rounded px-1 ${
                localMarks[i] === "green" ? MARK_CLASS.green : localMarks[i] === "red" ? MARK_CLASS.red : ""
              }`}
              onPointerDown={() => handleWordPointerDown(i)}
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
    </main>
  );
}

export default Stage4Analysis;
