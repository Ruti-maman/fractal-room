import { supabase } from "./supabase";

/**
 * ייצוא כל נתוני הסדנה - הדרישה "בסוף נדרש ייצוא של כל הנתונים" (סעיף 1
 * ב-CLAUDE.md), ותנאי לפני סדנה אמיתית: "סדנה חדשה" מוחקת את כל ההפעלות
 * הקודמות (ראו workshopActions.ts), ובלי ייצוא הכול הולך לאיבוד.
 *
 * שני פורמטים, משתי סיבות שונות:
 * 1. **טבלה (CSV)** - לקריאה. נפתחת באקסל/Google Sheets, שורה לכל פריט
 *    (משתתפת, השראה, ביטוי מתויג, פתרון, דירוג...) בעברית קריאה.
 *    מתחילה ב-BOM, אחרת אקסל פותח את העברית כג'יבריש.
 * 2. **גיבוי מלא (JSON)** - השורות הגולמיות מכל הטבלאות, בלי לאבד שדה.
 *    לא נועד לקריאה, אלא כדי שאפשר יהיה לשחזר/לנתח אחר כך.
 *
 * הייצוא קורא את **כל** ההפעלות שבמסד (בפועל בדרך כלל אחת, כי "סדנה חדשה"
 * מוחקת את הקודמות). הכול נוצר בדפדפן - אין שרת ואין דומיין חדש.
 */

interface Row {
  [key: string]: unknown;
}

export interface WorkshopDump {
  exported_at: string;
  programs: Row[];
  workshops: Row[];
  groups: Row[];
  participants: Row[];
  responses: Row[];
  media: Row[];
}

async function selectAll(table: string, orderBy = "created_at"): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: true });
  if (error) throw new Error(`קריאת הטבלה ${table} נכשלה: ${error.message}`);
  return (data ?? []) as Row[];
}

export async function fetchWorkshopDump(): Promise<WorkshopDump> {
  const [programs, workshops, groups, participants, responses, media] = await Promise.all([
    selectAll("programs"),
    selectAll("workshops"),
    selectAll("groups", "screen_number"),
    selectAll("participants"),
    selectAll("responses"),
    selectAll("media"),
  ]);
  return { exported_at: new Date().toISOString(), programs, workshops, groups, participants, responses, media };
}

// ---------------------------------------------------------------------------
// הטבלה הקריאה
// ---------------------------------------------------------------------------

const HEADERS = ["סדנה", "מסך", "קבוצה", "שלב", "נושא", "תוכן", "פירוט", "זמן"];

const COLOR_LABELS: Record<string, string> = { green: "חוזקה", red: "חסם" };

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function formatTime(value: unknown): string {
  const s = str(value);
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("he-IL");
}

/** הופך שורת responses אחת לשורה אחת או יותר בטבלה: [נושא, תוכן, פירוט]. */
function describeResponse(
  type: string,
  data: Row,
  groupLabel: (id: string) => string,
  sharedInspirations: string[],
): [string, string, string][] {
  switch (type) {
    case "inspirations": {
      const items = (data.items as { text?: string; author?: string }[] | undefined) ?? [];
      return items
        .filter((i) => str(i.text).trim())
        .map((i) => ["השראה", str(i.text), i.author ? `נכתבה ע"י ${groupLabel(i.author)}` : ""]);
    }
    case "inspirations_selection": {
      const selected = (data.selected as number[] | undefined) ?? [];
      return selected.map((index, n) => [
        "השראה שנבחרה",
        sharedInspirations[index] ?? `השראה מס' ${index + 1}`,
        `בחירה ${n + 1}`,
      ]);
    }
    case "text_marking": {
      const phrases = (data.phrases as { color?: string; category?: string; text?: string }[] | undefined) ?? [];
      return phrases.map((p) => [
        COLOR_LABELS[str(p.color)] ?? "סימון",
        str(p.text),
        p.category ? `קטגוריה: ${p.category}` : "",
      ]);
    }
    case "functioning_picture": {
      const rows: [string, string, string][] = [];
      if (data.sentence1) rows.push(["תמונת תפקוד (AI)", str(data.sentence1), "משפט 1"]);
      if (data.sentence2) rows.push(["תמונת תפקוד (AI)", str(data.sentence2), "משפט 2"]);
      if (data.group_conclusion) rows.push(["המסקנה המעשית", str(data.group_conclusion), ""]);
      return rows;
    }
    case "discussion_started":
      return [["תחילת דיון", "הקבוצה פתחה את הדיון", ""]];
    case "solution_text":
      return [["הפתרון שהוקלד", str(data.text), ""]];
    case "clip_transcript": {
      const segments = (data.segments as { text?: string }[] | undefined) ?? [];
      const text = segments.map((s) => str(s.text).trim()).filter(Boolean).join(" ");
      return text ? [["תמלול ההקלטה", text, ""]] : [];
    }
    case "video_rating": {
      const votes =
        (data.votes as Record<string, number[]> | undefined) ??
        Object.fromEntries(
          Object.entries((data.ratings as Record<string, number> | undefined) ?? {}).map(([k, v]) => [k, [v]]),
        );
      return Object.entries(votes).map(([ratedId, stars]) => {
        const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
        return [
          "דירוג סרטון",
          `${groupLabel(ratedId)}: ממוצע ${avg.toFixed(1)} כוכבים`,
          `הצבעות: ${stars.join(", ")}`,
        ];
      });
    }
    case "closing_principle":
      return [["משפט הסיום (AI)", str(data.sentence), ""]];
    case "principles": {
      const list = (data.principles as string[] | undefined) ?? [];
      return list.filter((p) => str(p).trim()).map((p, i) => ["עיקרון", str(p), `עיקרון ${i + 1}`]);
    }
    default:
      // סוג תשובה שנוסף אחרי שהקובץ הזה נכתב - לא מאבדים אותו, רק לא מפרשים.
      return [[type, JSON.stringify(data), ""]];
  }
}

export function buildReadableRows(dump: WorkshopDump): string[][] {
  const groupsById = new Map(dump.groups.map((g) => [str(g.id), g]));
  const workshopIndex = new Map(dump.workshops.map((w, i) => [str(w.id), i + 1]));

  const groupLabel = (id: string) => {
    const g = groupsById.get(id);
    if (!g) return "קבוצה לא ידועה";
    return str(g.name).trim() || `מסך ${str(g.screen_number)}`;
  };

  const rows: string[][] = [];
  const push = (workshopId: string, groupId: string | null, stage: unknown, cells: [string, string, string], time: unknown) => {
    const g = groupId ? groupsById.get(groupId) : undefined;
    rows.push([
      `סדנה ${workshopIndex.get(workshopId) ?? "?"}`,
      g ? str(g.screen_number) : "",
      g ? groupLabel(groupId!) : "כל הקבוצות",
      str(stage),
      ...(cells.map((c) => c.trim()) as [string, string, string]),
      formatTime(time),
    ]);
  };

  for (const w of dump.workshops) {
    const wid = str(w.id);
    const program = dump.programs.find((p) => p.id === w.program_id);
    rows.push([
      `סדנה ${workshopIndex.get(wid)}`,
      "",
      "",
      "",
      "פרטי הסדנה",
      str(program?.name) || "תוכנית",
      w.status === "active" ? "פעילה" : "הסתיימה",
      formatTime(w.created_at),
    ]);

    const groups = dump.groups.filter((g) => g.workshop_id === wid);
    for (const g of groups) {
      const gid = str(g.id);
      push(wid, gid, "", ["קבוצה", groupLabel(gid), `הגיעה עד שלב ${str(g.current_stage)}`], null);
      for (const p of dump.participants.filter((p) => p.group_id === gid)) {
        push(wid, gid, 2, ["משתתפת", str(p.name), ""], p.created_at);
      }
    }

    const responses = dump.responses.filter((r) => r.workshop_id === wid);
    const shared = responses.find((r) => r.type === "inspirations");
    const sharedInspirations = (((shared?.data as Row | undefined)?.items as { text?: string }[] | undefined) ?? []).map(
      (i) => str(i.text),
    );

    // תשובות והקלטות יחד, לפי סדר השלבים ובתוך שלב לפי מסך - כך הטבלה
    // נקראת כמו מהלך הסדנה (ההקלטה של קבוצה צמודה לפתרון שלה בשלב 7)
    const entries = [
      ...responses.map((r) => ({ kind: "response" as const, row: r })),
      ...dump.media.filter((m) => m.workshop_id === wid).map((m) => ({ kind: "media" as const, row: m })),
    ];
    const screenOf = (r: Row) => Number(groupsById.get(str(r.group_id))?.screen_number ?? 0);
    entries.sort(
      (a, b) =>
        Number(a.row.stage_number) - Number(b.row.stage_number) ||
        screenOf(a.row) - screenOf(b.row) ||
        new Date(str(a.row.created_at)).getTime() - new Date(str(b.row.created_at)).getTime(),
    );

    for (const { kind, row: r } of entries) {
      if (kind === "media") {
        push(wid, str(r.group_id), r.stage_number, ["הקלטה", str(r.url), "קישור לסרטון"], r.created_at);
        continue;
      }
      const type = str(r.type);
      // ההשראות ומשפט הסיום שייכים לכל הקבוצות, גם אם נשמרו תחת קבוצה אחת
      const groupId = type === "inspirations" || type === "closing_principle" ? null : str(r.group_id);
      for (const cells of describeResponse(type, (r.data as Row) ?? {}, groupLabel, sharedInspirations)) {
        push(wid, groupId, r.stage_number, cells, r.created_at);
      }
    }
  }

  return rows;
}

function csvCell(value: string): string {
  // אקסל מפרש תא שמתחיל ב-= + - @ כנוסחה; טקסט של משתתפות לא אמור לרוץ כנוסחה
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  const lines = [HEADERS, ...rows].map((row) => row.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// הורדה
// ---------------------------------------------------------------------------

function fileStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // דפדפנים ישנים מתחילים את ההורדה רק אחרי שהאירוע מסתיים
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExportFormat = "csv" | "json";

/** שולפת את כל הנתונים ומורידה קובץ. מחזירה כמה פריטים יוצאו, או שגיאה. */
export async function exportWorkshopData(format: ExportFormat): Promise<{ error: string | null; count: number }> {
  try {
    const dump = await fetchWorkshopDump();
    if (dump.workshops.length === 0) return { error: "אין במסד אף סדנה לייצא.", count: 0 };

    if (format === "csv") {
      const rows = buildReadableRows(dump);
      download(toCsv(rows), `סדנת-פרקטל_${fileStamp()}.csv`, "text/csv;charset=utf-8");
      return { error: null, count: rows.length };
    }

    download(JSON.stringify(dump, null, 2), `סדנת-פרקטל_גיבוי_${fileStamp()}.json`, "application/json");
    return { error: null, count: dump.responses.length + dump.participants.length + dump.media.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}
