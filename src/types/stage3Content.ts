export interface Stage3Content {
  dilemma_text: string;
  transition_text: string;
  /** מסך הפתיחה והוראות השמש (לפי האפיון). ניתן לעריכה מה-DB. */
  intro?: Partial<Stage3IntroTexts>;
}

export interface Stage3IntroTexts {
  /** שורות מסך הפתיחה, לפי הסדר. bold = שורה מודגשת. */
  lines: { text: string; bold?: boolean }[];
  start_label: string;
  step1: string;
  step2: string;
  strip_hint: string;
}

export interface InspirationItem {
  text: string;
  /**
   * הקבוצה שכתבה את ההשראה - רק היא יכולה לערוך אותה. שדה בתוך ה-JSON,
   * לא עמודה בטבלה. השראות ישנות בלי השדה הזה פתוחות לעריכה לכולן.
   */
  author?: string;
}
