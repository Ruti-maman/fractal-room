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
 * יוצרת הפעלה חדשה ומאפסת את שלושת המסכים לשלב 1 (סעיף 6 ב-CLAUDE.md).
 * ההפעלה הקודמת מסומנת כ-finished, הנתונים שלה לא נמחקים.
 */
export async function startNewWorkshop(): Promise<{ error: string | null }> {
  const { programId, activeId, error: findError } = await findProgramId();
  if (findError || !programId) return { error: findError ?? "לא נמצאה תוכנית." };

  if (activeId) {
    const { error: finishError } = await supabase
      .from("workshops")
      .update({ status: "finished" })
      .eq("id", activeId);
    if (finishError) return { error: finishError.message };
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

  return { error: null };
}
