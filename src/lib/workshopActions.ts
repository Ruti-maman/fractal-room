import { supabase } from "./supabase";

/**
 * מוצאת את התוכנית (program) שההפעלה החדשה תרוץ עליה, בשלושה מדרגים:
 *
 * 1. ההפעלה הפעילה - המקרה הרגיל, ממשיכים עם אותה תוכנית.
 * 2. אם אין פעילה: ההפעלה האחרונה שהייתה, בכל סטטוס. זה קורה אחרי שמסיימים
 *    סדנה, או אחרי ניקוי נתוני בדיקה - ואז אין שום סיבה שלא נוכל להתחיל מחדש.
 * 3. אם אין אף הפעלה (מסד נקי לגמרי): התוכנית הראשונה בטבלת programs.
 *
 * בלי המדרגים האלה "סדנה חדשה" נופל ברגע שאין הפעלה פעילה, והמערכת נתקעת
 * במצב שאי אפשר לצאת ממנו דרך הממשק.
 */
async function findProgramId(): Promise<{ programId: string | null; activeId: string | null; error: string | null }> {
  const { data: active, error: activeError } = await supabase
    .from("workshops")
    .select("id, program_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeError) return { programId: null, activeId: null, error: activeError.message };
  if (active) return { programId: active.program_id, activeId: active.id, error: null };

  const { data: last } = await supabase
    .from("workshops")
    .select("program_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.program_id) return { programId: last.program_id, activeId: null, error: null };

  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (program?.id) return { programId: program.id, activeId: null, error: null };

  return {
    programId: null,
    activeId: null,
    error: "אין אף תוכנית במסד הנתונים. צריך להריץ את קובצי ה-seed שבתיקיית supabase.",
  };
}

/**
 * מוחקת הפעלה קודמת על כל מה שנתלה בה: משתתפות, תשובות, מדיה, קבוצות.
 * הסדר חשוב - משתתפות תלויות בקבוצות, ולכן הן נמחקות ראשונות.
 */
async function deleteWorkshop(workshopId: string): Promise<string | null> {
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("workshop_id", workshopId);
  if (groupsError) return groupsError.message;

  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length > 0) {
    const { error } = await supabase.from("participants").delete().in("group_id", groupIds);
    if (error) return error.message;
  }

  for (const table of ["responses", "media"] as const) {
    const { error } = await supabase.from(table).delete().eq("workshop_id", workshopId);
    if (error) return error.message;
  }

  const { error: gError } = await supabase.from("groups").delete().eq("workshop_id", workshopId);
  if (gError) return gError.message;

  const { error: wError } = await supabase.from("workshops").delete().eq("id", workshopId);
  return wError ? wError.message : null;
}

/**
 * יוצרת הפעלה חדשה ומאפסת את שלושת המסכים לשלב 1.
 *
 * **ההפעלות הקודמות נמחקות לגמרי** - לפי בקשה מפורשת של הלקוחה, כדי שמסד
 * הנתונים לא יתמלא בשאריות בדיקה. זה שינוי ממה שתוכנן במקור בסעיף 6
 * ב-CLAUDE.md ("הנתונים הישנים נשמרים"), ולכן לפני הסדנה האמיתית חייבים
 * ייצוא נתונים - אחרת לחיצה על "סדנה חדשה" אחרי סדנה אמיתית מוחקת הכול.
 */
export async function startNewWorkshop(): Promise<{ error: string | null }> {
  const { programId, error: findError } = await findProgramId();
  if (findError || !programId) return { error: findError ?? "לא נמצאה תוכנית." };

  // מחיקת כל ההפעלות הקודמות (כולל הפעילה), עם כל הנתונים שלהן
  const { data: previous, error: listError } = await supabase.from("workshops").select("id");
  if (listError) return { error: listError.message };
  for (const w of previous ?? []) {
    const error = await deleteWorkshop(w.id);
    if (error) return { error };
  }

  const { data: newWorkshop, error: createError } = await supabase
    .from("workshops")
    .insert({ program_id: programId, status: "active" })
    .select("id")
    .single();
  if (createError || !newWorkshop) return { error: createError?.message ?? "יצירת ההפעלה נכשלה." };

  const { error: groupsError } = await supabase.from("groups").insert(
    [1, 2, 3].map((screen_number) => ({
      workshop_id: newWorkshop.id,
      screen_number,
      current_stage: 1,
    })),
  );
  if (groupsError) return { error: groupsError.message };

  // ניקוי ההקלטות שנשמרו כקבצים בפרויקט מהפעלות קודמות. קיים רק בשרת
  // הפיתוח (ראו vite-plugin-local-clips.ts); באתר שבענן הקריאה פשוט נכשלת
  // בשקט ואין מה לנקות שם.
  try {
    await fetch(`/__clips/cleanup?keep=${newWorkshop.id}`, { method: "POST" });
  } catch {
    // אין תוסף/אין שרת פיתוח - לא קריטי.
  }

  return { error: null };
}
