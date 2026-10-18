import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * מתי הקבוצה התחילה את הדיון בשלב 6 (מסך הטיימר של 10 הדקות).
 *
 * נשמר כשורה ב-responses (type "discussion_started") ולא במצב מקומי - כך
 * רענון באמצע הדיון חוזר בדיוק לאותו מסך ולאותו זמן שנותר, בלי לשנות את
 * מבנה מסד הנתונים. per-group, ולכן אין צורך בערוץ realtime: רק המסך של
 * הקבוצה עצמה כותב וקורא.
 */
export function useDiscussionStart(workshopId: string, groupId: string) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("responses")
      .select("data")
      .eq("workshop_id", workshopId)
      .eq("group_id", groupId)
      .eq("stage_number", 6)
      .eq("type", "discussion_started")
      .order("created_at", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const row = data?.[0]?.data as { started_at?: string } | undefined;
        setStartedAt(row?.started_at ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workshopId, groupId]);

  async function start() {
    if (startedAt) return;
    const now = new Date().toISOString();
    // מציגות מיד, בלי לחכות לשרת - הטיימר מחושב מאותו זמן שנשמר
    setStartedAt(now);
    await supabase
      .from("responses")
      .insert({
        workshop_id: workshopId,
        group_id: groupId,
        stage_number: 6,
        type: "discussion_started",
        data: { started_at: now },
      })
      .then();
  }

  return { startedAt, loading, start };
}
