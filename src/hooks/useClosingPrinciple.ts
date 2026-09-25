import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 2000;

/**
 * משפט הסיום של הסדנה (שלב 10, שקף 15) - משפט אחד שה-AI מנסח מתוך כל מה
 * שהקבוצות יצרו לאורך הסדנה. הוא **משותף לכל שלושת המסכים**: נשמר כשורה
 * אחת ב-responses (type "closing_principle") לפי workshop_id, ולכן כולן
 * מציגות בדיוק את אותו משפט.
 *
 * הניסוח מופעל פעם אחת: המסך הראשון שמגיע לשלב מבקש מה-Edge Function לנסח,
 * וזו מחזירה את הקיים אם כבר נוסח. גם אם שלושת המסכים מבקשים באותו רגע -
 * תיווצר שורה אחת בלבד (ראו הבדיקה מול מרוץ תזמון בפונקציה עצמה).
 */
export function useClosingPrinciple(workshopId: string, groupId: string) {
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let asked = false;

    async function readRow() {
      const { data } = await supabase
        .from("responses")
        .select("data")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 10)
        .eq("type", "closing_principle")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      return (data?.data as { sentence?: string })?.sentence ?? "";
    }

    async function tick() {
      const existing = await readRow();
      if (cancelled) return;

      if (existing) {
        setSentence(existing);
        setLoading(false);
        return;
      }

      // אין עדיין משפט - מבקשים ניסוח, פעם אחת מכל מסך
      if (!asked) {
        asked = true;
        try {
          const { data, error: fnError } = await supabase.functions.invoke(
            "generate-closing-principle",
            { body: { workshop_id: workshopId, group_id: groupId } },
          );
          if (cancelled) return;
          const result = (data as { sentence?: string; error?: string }) ?? {};
          if (result.sentence) {
            setSentence(result.sentence);
            setLoading(false);
          } else if (fnError || result.error) {
            setError(result.error ?? "הניסוח נכשל");
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setError("לא הצלחנו להגיע לשירות הניסוח");
            setLoading(false);
          }
        }
      }
    }

    tick();
    // רשת ביטחון: אם מסך אחר ניסח בינתיים, נראה את זה גם בלי realtime
    const interval = setInterval(tick, SAFETY_NET_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workshopId, groupId]);

  return { sentence, loading, error };
}
