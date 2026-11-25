import { supabase } from "./supabase";
import type { RoomLoopRow, RoomLoopColor, RoomLoopKind } from "../types/roomLoop";

/*
 * פעולות הניהול של הספריות ב-/admin (2026-11-25, דרישת הלקוחה):
 *   "להוסיף כפתור הוספת דילמה ומחיקת דילמה"
 *   "להוסיף כפתור הוספת לופ עם אפשרות ללופ ידני או סרטון" + צבע כתום/כחול/לבן
 *
 * סרטונים עולים ל-Supabase Storage (bucket media), כמו ההקלטות - אותו דומיין,
 * בלי שירות חדש. כמו בשאר הפרויקט, כל קריאה ל-Supabase ממתינה לתשובה
 * (בלי await הבקשה לא נשלחת בכלל).
 */

const BUCKET = "media";

/** מעלה קובץ ל-Storage ומחזירה את הכתובת הציבורית שלו */
async function uploadFile(file: File, folder: string): Promise<{ url: string | null; error: string | null }> {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "video/mp4",
    upsert: false,
  });
  if (error) return { url: null, error: `העלאת הסרטון נכשלה: ${error.message}` };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ---------------------------------------------------------------------------
// דילמות
// ---------------------------------------------------------------------------

export interface NewDilemma {
  programId: string;
  title: string;
  summary: string;
  profileText: string;
  video: File | null;
}

export async function addDilemma(d: NewDilemma): Promise<string | null> {
  let videoUrl: string | null = null;
  if (d.video) {
    const up = await uploadFile(d.video, "dilemmas");
    if (up.error) return up.error;
    videoUrl = up.url;
  }
  // בסוף הספרייה
  const { data: last } = await supabase
    .from("dilemmas")
    .select("sort_order")
    .eq("program_id", d.programId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("dilemmas").insert({
    program_id: d.programId,
    title: d.title.trim(),
    summary: d.summary.trim() || null,
    profile_text: d.profileText.trim() || null,
    video_url: videoUrl,
    sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1,
  });
  return error ? `הדילמה לא נשמרה: ${error.message}` : null;
}

/** מחיקת דילמה. סדנה שבחרה בה חוזרת לתוכן השלבים הרגיל (on delete set null). */
export async function deleteDilemma(id: string): Promise<string | null> {
  const { error } = await supabase.from("dilemmas").delete().eq("id", id);
  return error ? `המחיקה נכשלה: ${error.message}` : null;
}

// ---------------------------------------------------------------------------
// לופים נוספים (טבלת room_loops - supabase/add_room_loops.sql)
// ---------------------------------------------------------------------------

export interface NewRoomLoop {
  title: string;
  kind: RoomLoopKind;
  color: RoomLoopColor;
  /** לופ ידני: שקף לכל פסקה */
  slides: string[];
  video: File | null;
}

export async function fetchRoomLoops(): Promise<RoomLoopRow[]> {
  const { data } = await supabase
    .from("room_loops")
    .select("id, title, kind, color, slides, video_url, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as RoomLoopRow[] | null) ?? [];
}

export async function addRoomLoop(l: NewRoomLoop): Promise<string | null> {
  let videoUrl: string | null = null;
  if (l.kind === "video") {
    if (!l.video) return "בחרו קובץ סרטון.";
    const up = await uploadFile(l.video, "loops");
    if (up.error) return up.error;
    videoUrl = up.url;
  }
  const slides = l.kind === "manual" ? l.slides.map((t) => t.trim()).filter(Boolean).map((text) => ({ text })) : [];
  if (l.kind === "manual" && slides.length === 0) return "כתבו לפחות שקף אחד.";
  const { error } = await supabase.from("room_loops").insert({
    title: l.title.trim(),
    kind: l.kind,
    color: l.color,
    slides,
    video_url: videoUrl,
    sort_order: Date.now() % 2147483647,
  });
  return error ? `הלופ לא נשמר: ${error.message}` : null;
}

export async function deleteRoomLoop(id: string): Promise<string | null> {
  const { error } = await supabase.from("room_loops").delete().eq("id", id);
  return error ? `המחיקה נכשלה: ${error.message}` : null;
}
