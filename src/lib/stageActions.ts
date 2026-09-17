import { supabase } from "./supabase";

/**
 * פותחת שלב שיתופי (sync gate) - נכתב רק אם עדיין ריק, כדי שלא ייכתב פעמיים
 * כשכמה מסכים מזהים בו-זמנית שכולם הגיעו (ראו סעיף 5 ב-CLAUDE.md).
 */
export async function startSharedStage(workshopId: string) {
  await supabase
    .from("workshops")
    .update({ shared_stage_started_at: new Date().toISOString() })
    .eq("id", workshopId)
    .is("shared_stage_started_at", null);
}
