/**
 * גישה להקלטות ששמורות **כקבצים בתוך הפרויקט** (public/recordings), דרך תוסף
 * שרת הפיתוח vite-plugin-local-clips. הסיבה המלאה מתועדת שם: הסינון חוסם
 * הורדת וידאו מהענן, וקובץ מקומי נטען מהמחשב עצמו ולכן תמיד עובד - וגם עובר
 * עם הפרויקט לדיסק-און-קי.
 *
 * כל הפונקציות כאן "שקטות": באתר שעולה לענן אין endpoint כזה, והן פשוט
 * מחזירות null/false. הקוד שקורא להן ממשיך משם לענן כרגיל.
 */

/** הכתובת שבה הקובץ יישרת על ידי vite (public/ נשרת מהשורש). */
export function projectClipUrl(workshopId: string, groupId: string) {
  return `/recordings/${workshopId}/${groupId}.webm`;
}

/** שומרת עותק של ההקלטה כקובץ בפרויקט. מחזירה את הכתובת, או null אם לא זמין. */
export async function saveClipToProject(
  workshopId: string,
  groupId: string,
  blob: Blob,
): Promise<string | null> {
  try {
    const res = await fetch(`/__clips/save?workshop=${workshopId}&group=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: blob,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

/** אילו הקלטות של ההפעלה כבר קיימות כקבצים בפרויקט. */
export async function listProjectClips(workshopId: string): Promise<string[]> {
  try {
    const res = await fetch(`/__clips/list?workshop=${workshopId}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { groups?: string[] };
    return data.groups ?? [];
  } catch {
    return [];
  }
}
