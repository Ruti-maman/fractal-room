import { supabase } from "./supabase";

/**
 * יוצרת הפעלה חדשה ומאפסת את שלושת המסכים לשלב 1 (סעיף 6 ב-CLAUDE.md).
 * ההפעלה הקודמת מסומנת כ-finished, הנתונים שלה לא נמחקים.
 * ממשיכה עם אותה תוכנית (program) של ההפעלה הפעילה הקודמת.
 */
export async function startNewWorkshop(): Promise<{ error: string | null }> {
  const { data: current, error: currentError } = await supabase
    .from("workshops")
    .select("id, program_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (currentError) return { error: currentError.message };
  if (!current) return { error: "לא נמצאה הפעלה פעילה לשכפל ממנה את התוכנית." };

  const { error: finishError } = await supabase
    .from("workshops")
    .update({ status: "finished" })
    .eq("id", current.id);
  if (finishError) return { error: finishError.message };

  const { data: newWorkshop, error: createError } = await supabase
    .from("workshops")
    .insert({ program_id: current.program_id, status: "active" })
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
