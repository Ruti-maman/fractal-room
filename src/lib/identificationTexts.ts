/**
 * טקסטי מסע ההזדהות של שלב 2 וברירות המחדל שלהם (הועבר מ-Stage2Identification
 * ב-2026-11-19, כדי שגם המסך הגדול - /screen/4 - יציג את מסך הטיפים).
 */

/** טקסטי מסע ההזדהות - כולם ניתנים לעריכה מה-DB (content.identification). */
export interface IdentificationTexts {
  /** שורת המעבר שמופיעה בפתיחה, מעל "התחלקנה לשולחנות עבודה.". */
  shape_line: string;
  tables_title: string;
  tables_text?: string;
  participants_title: string;
  name_title: string;
  name_bonus?: string;
  tips_title: string;
  tips: { title: string; text: string }[];
  summary_title: string;
  /** המשפט במסך הסיכום (IV), מתחת לשם ולמשתתפות. */
  built_line: string;
  /** מופיע אחרי "שמירה והמשך", לפני "כלל הפרקטל" במסך מלא. */
  created_line: string;
  fractal_title: string;
  fractal_text: string;
}

/*
  ברירות מחדל - הנוסח של הלקוחה מהאפיון. משמשות רק כשאין טקסט ב-DB
  (ראו supabase/stage2_identification_texts.sql, שמכניס אותם לתוכנית).
*/
export const IDENTIFICATION_DEFAULTS: IdentificationTexts = {
  shape_line: "עכשיו משנים צורה, שמים את הפרקטל על השולחן.",
  tables_title: "התחלקנה לשולחנות עבודה.",
  participants_title: "הזינו את פרטי המשתתפות.",
  name_title: "בחרנה שם מקורי, קצר ומייצג לקבוצה.",
  name_bonus: "וצברו עליו ניקוד נוסף.",
  tips_title: "איך יוצרים שם שלא נשכח?",
  tips: [
    { title: "קצר", text: "מעט מילים, הרבה אופי." },
    { title: "קליט", text: "נכנס לראש ונשאר שם." },
    { title: "שלכן", text: "משקף משהו מהצורה, מהאופי או מהרעיון שלכן." },
    { title: "עם טוויסט", text: "חיבור מפתיע, משחק מילים, קריצה." },
    { title: "בלי הוראות הפעלה", text: "אם צריך להסביר אותו, הוא עוד לא מוכן." },
  ],
  summary_title: "הקבוצה שלנו:",
  built_line: "אתן כבר חלק מהצורה, בניתן לכן פרקטל.",
  created_line: "הקבוצה נוצרה בהצלחה",
  fractal_title: "כלל הפרקטל",
  fractal_text: "חלק קטן, אבל כבר רואים בו את השלם.",
};

/** טקסטי מסך "מי בחדר" - ניתנים לעריכה מה-DB (content.room). */
export interface RoomTexts {
  intro: string;
  journey_title: string;
  after_line: string;
  after_bold: string;
  waiting: string;
  /** הכפתור שמעביר לסרטון הדילמה. */
  start_button: string;
}

export const ROOM_DEFAULTS: RoomTexts = {
  intro: "התחברנו לחלקים, עכשיו רואים את התמונה.",
  journey_title: "איתנו במסע:",
  after_line: "כל קבוצה היא צורה אחרת,",
  after_bold: "עכשיו נראה איזו צורה תצליח לעשות שינוי בדפוס.",
  // לפי האפיון: "צוותים" ולא "קבוצות" בהודעת ההמתנה
  waiting: "המערכת ממתינה לכל הצוותים...",
  start_button: "אנחנו מתחילות, לצפייה בדילמה",
};
