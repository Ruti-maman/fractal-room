/**
 * כתובת סרטון של דילמה מהספרייה.
 *
 * הסרטונים יושבים ב-Supabase Storage (media/dilemmas/). אבל NetFree חוסם הורדת
 * קובצי וידאו משם (HTTP 418, "risk-type" - ראו סעיף 9 ב-CLAUDE.md), ולכן
 * במחשב הפיתוח הם לא היו מתנגנים. בשרת הפיתוח בלבד הכתובת מוחלפת בעותק
 * מקומי מ-public/dilemmas-local/ (לא נכנס ל-Git). באתר שבענן - הכתובת
 * המקורית, ובחדר צריך אישור של NetFree לסרטונים.
 */
export function dilemmaVideoSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (import.meta.env.DEV) {
    const m = url.match(/\/media\/dilemmas\/([^/?#]+)$/);
    if (m) return `/dilemmas-local/${m[1]}`;
  }
  return url;
}
