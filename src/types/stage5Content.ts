/** שורה אחת בהסבר שבפופ-אפ. `bold` לשורות שהלקוחה הדגישה. */
export interface ExplanationLine {
  text: string;
  bold?: boolean;
}

export interface SolutionOption {
  /** הכותרת - מה שכתוב על כפתור הבחירה. */
  label: string;
  correct: boolean;
  /** הסבר קצר בשורה אחת. נשאר לתאימות לתוכן ישן; `explanation_lines` גובר. */
  explanation: string;
  /** הטקסט הרץ שבפופ-אפ, שורה אחר שורה. */
  explanation_lines?: ExplanationLine[];
}

export interface Stage5Content {
  /** שורות הפתיחה שמעל הכותרת ("יש בעיה. יש תמונת מצב..."). */
  intro_lines?: string[];
  title?: string;
  options: SolutionOption[];
}
