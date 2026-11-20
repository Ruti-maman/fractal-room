/** דילמה מספריית הדילמות (טבלת dilemmas, supabase/add_dilemmas.sql). */
export interface Dilemma {
  id: string;
  program_id: string;
  sort_order: number;
  title: string;
  /** המשפט הקצר במרכז השמש (שלב 3) */
  summary: string | null;
  /** התיאור המלא שמסמנים עליו חוזקות וחסמים (שלב 4) */
  profile_text: string | null;
  /** הסרטון שצופים בו בשלב 2 */
  video_url: string | null;
}
