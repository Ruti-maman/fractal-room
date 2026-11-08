import type { Tip } from "../components/TipPopups";

/** שורה בכרטיס הפתיחה. `bold` לשורות שהלקוחה הדגישה. */
export interface Stage6Line {
  text: string;
  bold?: boolean;
}

export interface Stage6Content {
  /** משפט ההשראה הישן. לא מוצג יותר; נשאר לתאימות לתוכן ישן. */
  quote?: string;
  /** כרטיס הפתיחה: השאלה, הזמן והתוצר הנדרש. */
  intro_lines?: Stage6Line[];
  /** הכפתור שעובר למסך הדיון ("בואו נדבר על זה"). */
  start_label?: string;
  tips_title?: string;
  /** הכפתור שסוגר את פופ-אפ הטיפים (אחריו נכנס כלל הפרקטל). */
  tips_confirm_label?: string;
  tips?: Tip[];
  fractal_title?: string;
  fractal_text?: string;
  /** משך הדיון בדקות (טיימר המרכז, בנוסף לטיימר השלב). */
  discussion_minutes?: number;
  discussion_label?: string;
}
