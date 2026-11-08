/*
 * שמירה על עברית נקייה בטקסט שה-AI מנסח (Gemini).
 *
 * Gemini "גולש" לפעמים באמצע מילה עברית לאות מכתב אחר: פעם לאותיות קנאדה,
 * ופעם לאות אנגלית ("מהתבוננות לקkה"). על מסך ענק מול כל החדר זו תקלה
 * מביכה, ולכן כל טקסט AI שמוצג עובר כאן - רשת ביטחון גם לשורות שכבר
 * נשמרו לפני שה-Edge Functions התחילו לפסול ניסוחים כאלה.
 */

const HEBREW = "א-תװ-״";

/** אותיות מכתב שאינו עברי ואינו לטיני (קנאדה, קירילית...). */
const FOREIGN_SCRIPT = new RegExp(`[^${HEBREW}\\s\\p{P}\\p{S}0-9A-Za-z]`, "gu");

/** אות לטינית שצמודה לאות עברית - כלומר באמצע מילה עברית. */
const LATIN_IN_HEBREW_WORD = new RegExp(`(?<=[${HEBREW}])[A-Za-z]+|[A-Za-z]+(?=[${HEBREW}])`, "g");

/** true אם הטקסט משובש: כתב זר, או אות לועזית בתוך מילה עברית. */
export function hasMixedScript(text: string): boolean {
  const t = text.normalize("NFKC");
  return new RegExp(FOREIGN_SCRIPT.source, "u").test(t) || new RegExp(LATIN_IN_HEBREW_WORD.source).test(t);
}

/** מסירה את התווים המשובשים (כתב זר, ואותיות לועזיות בתוך מילים עבריות). */
export function cleanAiHebrew(text: string): string {
  return text
    .normalize("NFKC")
    .replace(FOREIGN_SCRIPT, "")
    .replace(LATIN_IN_HEBREW_WORD, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
