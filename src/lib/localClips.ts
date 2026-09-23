/**
 * מטמון מקומי להקלטות שלב 7, ב-IndexedDB של הדפדפן.
 *
 * למה זה קיים: ההקלטה נשמרת ב-Supabase Storage כרגיל, אבל **הורדה** של קובץ
 * וידאו מהדומיין הזה חסומה כרגע על ידי הסינון (NetFree מחזיר 418 עם סיבה
 * `risk-type` - נבדק ב-2026-09-23, ראו סעיף 9 ב-CLAUDE.md). התוצאה היא נגן
 * שחור, למרות שהכול נשמר כמו שצריך.
 *
 * הפתרון: ברגע שההקלטה נוצרת, שומרים עותק שלה גם בדפדפן עצמו. מסך הצפייה
 * המשותפת מנסה **קודם** את העותק המקומי ורק אחר כך את הכתובת ברשת. מכיוון
 * ש-IndexedDB משותף לכל הלשוניות של אותה כתובת אתר, שלוש הלשוניות
 * `/screen/1..3` על אותו מחשב רואות את שלוש ההקלטות - כך שהדגמה עובדת
 * במלואה גם בלי הסינון.
 *
 * מגבלה שחשוב להכיר: על שלוש פלזמות **נפרדות** בחדר, לכל מסך יש דפדפן משלו,
 * ולכן כל מסך יראה רק את ההקלטה שלו עד שהסינון יאשר הורדת וידאו מהדומיין.
 * זה גם שימושי בפני עצמו: אם הרשת נופלת באמצע, ההקלטה לא הולכת לאיבוד.
 */

const DB_NAME = "fractal-room";
const STORE = "clips";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** מפתח אחיד: הקלטה אחת לכל קבוצה בכל הפעלה. */
export function clipKey(workshopId: string, groupId: string) {
  return `${workshopId}:${groupId}`;
}

export async function saveLocalClip(key: string, blob: Blob) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // דפדפן שחוסם IndexedDB (גלישה פרטית) - ממשיכים בלי מטמון, לא עוצרים.
  }
}

export async function getLocalClip(key: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}
