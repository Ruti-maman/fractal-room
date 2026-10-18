export interface Stage4Content {
  profile_text: string;
  // רשימת הקטגוריות שבהן אפשר לתייג קטע מסומן (שקף 7) - גנרי: היום פדגוגי,
  // מחר עשוי להיות תחום אחר לגמרי, ולכן זה קורא מהתוכן ולא כתוב בקוד.
  categories: string[];
  /** מסך הפתיחה והוראת הסימון (לפי התסריט של הלקוחה). ניתן לעריכה מה-DB. */
  intro?: Partial<Stage4IntroTexts>;
}

export interface Stage4IntroTexts {
  /** שורות מסך הפתיחה, לפי הסדר. bold = שורה מודגשת. */
  lines: { text: string; bold?: boolean }[];
  /** הכפתור שצולל מהפתיחה למסך הסימון. */
  start_label: string;
  /** ההוראה שמתחת לכותרת במסך הסימון. */
  marking_hint: string;
}
