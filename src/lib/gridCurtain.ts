/*
 * ============================================================================
 *  מעבר "רשת הריבועים" בין מסכי שפת "עיתונאי" (2026-11-12)
 * ============================================================================
 *
 *  מה שקנה את ליבה של הלקוחה בהשראות: "גריד של ריבועים בולט וברור", חלוקה
 *  חדה בין צבע לבן, חיצים, וטיפוגרפיה מודרנית עם ניגוד בין ענק לזעיר. לכן
 *  המעבר הוא **הרשת עצמה**:
 *
 *    1. כיסוי - ריבועי הרשת (ברוחב עמודה, 12.5vw) מתמלאים בכחול אחד-אחד
 *       באלכסון, מהפינה הימנית-עליונה לשמאלית-תחתונה - בכיוון החץ ↙ של
 *       "התחילו". המסך הופך לעמוד כחול מלא, ועליו קווי רשת לבנים (בעמוד
 *       כחול מלא כן שמים קווים - knowledge/grid-lines-on-color-blocks.md).
 *    2. רגע טיפוגרפי - "01" ענק ודק מתגלגל ל-"02", עם שם השלב וריבוע אדום.
 *    3. גילוי - הריבועים מתרוקנים באותו כיוון, **חוץ משתי העמודות
 *       השמאליות**: הן נשארות, והופכות לבלוק הכחול של המסך הבא.
 *
 *  בנוי ב-DOM ישירות ב-body, מחוץ לעץ של React: הכיסוי מתחיל במסך אחד
 *  (שלב 1) ונגמר במסך אחר (שלב 2).
 *
 *  **שלוש רשתות ביטחון** (2026-11-12, אחרי שבמסך אמיתי הרשת נשארה תקועה):
 *    - StageRouter מבקש גילוי בכל שלב שאינו 1 - גם כשהקבוצה כבר הזדהתה
 *      ומגיעה ישר ל"מי בחדר", ולא רק כשטופס ההזדהות עולה.
 *    - נגיעה ברשת בזמן ההמתנה מגלה מיד.
 *    - אם אף אחד לא ביקש גילוי תוך כמה שניות - מגלים לבד.
 *  והמצב שמור על window ולא במשתנה של המודול: אחרי עדכון חם (HMR) בשרת
 *  הפיתוח עלולים להיות שני עותקים של המודול, ואז מי שכיסה ומי שמגלה לא
 *  ראו זה את זה.
 *
 *  ב-prefers-reduced-motion אין מעבר בכלל.
 */

import { useSyncExternalStore } from "react";

const COLS = 8;
/** השהיה בין ריבוע לשכנו באלכסון */
const STEP_MS = 42;
/** משך המילוי/הריקון של ריבוע אחד */
const CELL_MS = 460;
/** כמה זמן העמוד הכחול המלא נשאר, לפחות (הרגע הטיפוגרפי) */
const HOLD_MS = 1150;
/** השהיית הריקון אחרי שהטיפוגרפיה יוצאת */
const TYPE_OUT_MS = 260;
/** אם המסך הבא לא ביקש גילוי עד אז - מגלים בכל זאת */
const FALLBACK_MS = 5000;

type Phase = "idle" | "covering" | "held" | "revealing";

interface CurtainState {
  phase: Phase;
  root: HTMLDivElement | null;
  revealRequested: boolean;
  rows: number;
  fallback?: number;
  listeners: Set<() => void>;
}

const holder = window as unknown as { __fractalGridCurtain?: CurtainState };
const S: CurtainState = (holder.__fractalGridCurtain ??= {
  phase: "idle",
  root: null,
  revealRequested: false,
  rows: 5,
  listeners: new Set(),
});

function setPhase(next: Phase) {
  S.phase = next;
  /*
    כל עוד הרשת מכסה - כל ההנפשות של המסך שמתחת מושהות (data-curtain על
    <html>, ראו editorial.css). בלי זה הכניסה של האלמנטים בשלב החדש רצה
    מאחורי הרשת ונגמרה לפני שרואים אותה (2026-11-15, שלב 5).
  */
  if (next === "covering" || next === "held") {
    document.documentElement.setAttribute("data-curtain", "");
  } else {
    document.documentElement.removeAttribute("data-curtain");
  }
  S.listeners.forEach((fn) => fn());
}

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** זמן הכיסוי של המעבר הנוכחי (נקבע ב-coverWithGrid לפי הסוג) */
let sweep = 0;
function sweepMs() {
  return sweep;
}

/*
 * שלושה סוגי מעבר (2026-11-15, בקשת המפתחת: "תגוון במעברים", ו"גלילה
 * לצדדים כמו תיבות" מדרישות הלקוחה) - כולם מאותו חומר (ריבועי הרשת
 * הכחולים עם קווים לבנים), כל אחד בתנועה אחרת:
 *   diagonal - הריבועים מתמלאים באלכסון ↙ (פתיחה -> הזדהות).
 *   columns  - עמודות הרשת יורדות אחת-אחת מימין, כמו תיבות שנערמות.
 *   slide    - "תיבה" כחולה שלמה נכנסת מהצד ויוצאת לצד השני - גלילה
 *              לצדדים בין שלבים, כמו מעבר בין חדרים.
 */
export type CurtainMode = "diagonal" | "columns" | "slide";

interface CoverOptions {
  /** המספר שמתגלגל ממנו (המסך הנוכחי), למשל "01" */
  from: string;
  /** המספר שמתגלגל אליו (המסך הבא), למשל "02" */
  to: string;
  /** שם המסך הבא, ליד המספר */
  label: string;
  mode?: CurtainMode;
  /**
   * שתי העמודות השמאליות נשארות ונהיות הבלוק הכחול של המסך הבא (רק
   * בהזדהות, שיש לה בלוק כזה). ברירת המחדל: כן ב-diagonal בלבד.
   */
  stay?: boolean;
}

/**
 * מכסה את המסך ברשת. מחזיר כמה מילישניות לחכות עד שהמסך מכוסה כולו
 * (אז בטוח להחליף את המסך שמתחת), או -1 אם אין מעבר (תנועה מופחתת /
 * מעבר שכבר רץ) - ואז מחליפים מיד.
 */
export function coverWithGrid({ from, to, label, mode = "diagonal", stay }: CoverOptions): number {
  if (S.phase !== "idle" || reducedMotion()) return -1;

  const colPx = window.innerWidth / COLS;
  S.rows = Math.ceil(window.innerHeight / colPx);
  S.revealRequested = false;
  const keep = stay ?? mode === "diagonal";
  // מספר הצעדים עד הריבוע האחרון, לפי סוג המעבר
  const lastIndex = mode === "columns" ? (COLS - 1) * 2 + (S.rows - 1) : COLS - 1 + S.rows - 1;
  sweep = mode === "slide" ? 760 : lastIndex * STEP_MS + CELL_MS;

  const root = document.createElement("div");
  root.className = `gc gc--${mode}`;
  root.setAttribute("aria-hidden", "true");
  root.style.setProperty("--gc-step", `${STEP_MS}ms`);
  root.style.setProperty("--gc-cell", `${CELL_MS}ms`);
  root.style.setProperty("--gc-sweep", `${sweepMs()}ms`);
  root.style.setProperty("--gc-out", `${TYPE_OUT_MS}ms`);
  // נגיעה בעמוד הכחול בזמן ההמתנה - מגלים מיד (רשת ביטחון)
  root.addEventListener("pointerdown", () => revealGrid());

  if (mode === "slide") {
    // תיבה אחת שלמה - נכנסת מהצד ויוצאת לצד השני
    const slab = document.createElement("div");
    slab.className = "gc-slab";
    root.appendChild(slab);
  } else {
    const cells = document.createElement("div");
    cells.className = "gc-cells";
    for (let row = 0; row < S.rows; row++) {
      for (let col = 0; col < COLS; col++) {
        // col 0 = העמודה הימנית (RTL). diagonal: מימין-למעלה לשמאל-למטה.
        // columns: עמודה אחרי עמודה מימין, וכל עמודה מלמעלה למטה.
        const cell = document.createElement("span");
        cell.className = keep && col >= COLS - 2 ? "gc-cell gc-cell--stay" : "gc-cell";
        cell.style.left = `${(COLS - 1 - col) * 12.5}vw`;
        cell.style.top = `${row * 12.5}vw`;
        cell.style.setProperty("--gc-i", String(mode === "columns" ? col * 2 + row : col + row));
        cells.appendChild(cell);
      }
    }
    root.appendChild(cells);
  }

  // הרגע הטיפוגרפי: המספר מתגלגל, ולידו שם המסך וריבוע אדום
  const type = document.createElement("div");
  type.className = "gc-type";
  type.innerHTML = `
    <div class="gc-num"><span class="gc-roll"><span></span><span></span></span></div>
    <div class="gc-meta"><span class="gc-square"></span><span class="gc-label"></span></div>
    <svg class="gc-arrow" viewBox="0 0 24 24"><path d="M19 5 L5 19 M5 8 L5 19 L16 19" fill="none"
      stroke="currentColor" stroke-width="1.2" stroke-linecap="square" vector-effect="non-scaling-stroke"/></svg>`;
  const [a, b] = type.querySelectorAll(".gc-roll > span");
  a.textContent = from;
  b.textContent = to;
  type.querySelector(".gc-label")!.textContent = label;
  root.appendChild(type);

  document.body.appendChild(root);
  S.root = root;
  setPhase("covering");

  window.setTimeout(() => {
    if (S.phase !== "covering" || S.root !== root) return;
    setPhase("held");
    maybeReveal();
  }, sweepMs() + HOLD_MS);
  window.clearTimeout(S.fallback);
  S.fallback = window.setTimeout(revealGrid, sweepMs() + HOLD_MS + FALLBACK_MS);

  return sweepMs();
}

/** true כשמעבר כבר באוויר - אז לא פותחים עוד אחד */
export function curtainBusy() {
  return S.phase !== "idle";
}

/** המסך הבא מוכן - מגלים (מיד, או כשהרגע הטיפוגרפי נגמר). */
export function revealGrid() {
  if (S.phase === "idle") return;
  S.revealRequested = true;
  maybeReveal();
}

function maybeReveal() {
  if (S.phase !== "held" || !S.revealRequested || !S.root) return;
  window.clearTimeout(S.fallback);
  const el = S.root;
  el.classList.add("is-revealing");
  setPhase("revealing");
  window.setTimeout(() => {
    el.remove();
    if (S.root === el) S.root = null;
    setPhase("idle");
  }, TYPE_OUT_MS + sweepMs() + 120);
}

function subscribe(fn: () => void) {
  S.listeners.add(fn);
  return () => {
    S.listeners.delete(fn);
  };
}

/** true כל עוד הרשת מכסה את המסך - המסך הבא משהה בינתיים את הכניסה שלו. */
export function useCurtainHeld() {
  return useSyncExternalStore(subscribe, () => S.phase === "covering" || S.phase === "held");
}
