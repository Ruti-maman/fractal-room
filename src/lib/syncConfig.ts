/**
 * מצב הסנכרון בין המסכים (סעיף 2 ב-CLAUDE.md).
 * "realtime": Supabase Realtime (WebSocket) - ברירת המחדל.
 * "polling": שליפה חוזרת כל POLLING_INTERVAL_MS מילישניות - fallback
 *            למקרה שה-WebSocket חסום/לא יציב ברשת של החדר.
 * לשינוי המצב עבור כל המערכת: לשנות רק את הערך כאן.
 */
export const SYNC_MODE: "realtime" | "polling" = "realtime";

export const POLLING_INTERVAL_MS = 1500;
