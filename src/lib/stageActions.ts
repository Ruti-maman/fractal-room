import { supabase } from "./supabase";

/**
 * פותחת שלב שיתופי (sync gate) - נכתב רק אם השלב המשותף השמור שונה מהשלב
 * הנוכחי (או ריק), כדי שכל שלב משותף (2, 7, 8, 10) יקבל זמן התחלה טרי משלו,
 * ולא "יירש" זמן ישן משלב משותף קודם. גם מונע כתיבה כפולה כשכמה מסכים
 * מזהים בו-זמנית שכולן הגיעו (ראו סעיף 5 ב-CLAUDE.md).
 */
export async function startSharedStage(workshopId: string, stageNumber: number) {
  await supabase
    .from("workshops")
    .update({
      shared_stage_started_at: new Date().toISOString(),
      shared_stage_number: stageNumber,
    })
    .eq("id", workshopId)
    .or(`shared_stage_number.is.null,shared_stage_number.neq.${stageNumber}`)
    .then();
}
