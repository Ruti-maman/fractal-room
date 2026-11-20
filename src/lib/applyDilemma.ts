import type { ProgramStage } from "../types/stage";
import type { Dilemma } from "../types/dilemma";
import { dilemmaVideoSrc } from "./dilemmaVideo";

/**
 * מכניס את הדילמה שנבחרה לתוכן השלבים (ספריית הדילמות, 2026-11-19).
 *
 * הרכיבים של שלבים 2-4 ממשיכים לקרוא את אותם שדות כמו קודם - רק הערכים
 * מגיעים עכשיו מהדילמה שנבחרה ב-/admin:
 *   שלב 2 - dilemma_video_url (הסרטון), dilemma_title (כותרת המסך)
 *   שלב 3 - dilemma_text (המשפט במרכז השמש)
 *   שלב 4 - profile_text (הטקסט שמסמנים עליו)
 * שדה ריק בדילמה לא דורס את מה שכבר יש בתוכן השלב.
 */
export function applyDilemma(stages: ProgramStage[], dilemma: Dilemma | null): ProgramStage[] {
  if (!dilemma) return stages;
  const pick = (v: string | null | undefined) => (v && v.trim() ? v : undefined);

  const patches: Record<number, Record<string, string | undefined>> = {
    2: { dilemma_video_url: pick(dilemmaVideoSrc(dilemma.video_url)), dilemma_title: pick(dilemma.title) },
    3: { dilemma_text: pick(dilemma.summary) },
    4: { profile_text: pick(dilemma.profile_text) },
  };

  return stages.map((st) => {
    const patch = patches[st.stage_number];
    if (!patch) return st;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    return { ...st, content: { ...st.content, ...defined } };
  });
}
