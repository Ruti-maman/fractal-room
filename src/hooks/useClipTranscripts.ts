import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * כתוביות ההקלטות של שלב 7. התמלול עצמו נעשה ב-Edge Function
 * (supabase/functions/transcribe-clip) ונשמר ב-responses, כך שכל שלושת
 * המסכים מציגים בדיוק את אותן כתוביות ושהתמלול ירוץ פעם אחת בלבד.
 *
 * הכתוביות החיות שבמסך ההקלטה הן מנגנון אחר לגמרי (useLiveCaptions) - הן
 * רצות בדפדפן בזמן הדיבור ואינן נשמרות.
 */

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** מבקשת תמלול להקלטה אחת. נכשלת בשקט - כתוביות הן תוספת, לא תנאי. */
export async function requestTranscript(workshopId: string, groupId: string) {
  try {
    await supabase.functions.invoke("transcribe-clip", {
      body: { workshop_id: workshopId, group_id: groupId },
    });
  } catch {
    // ה-Edge Function לא נפרסה / אין מפתח / אין רשת - ממשיכים בלי כתוביות.
  }
}

/** ממירה קטעים לקובץ WebVTT, הפורמט שהנגן של הדפדפן יודע להציג. */
export function segmentsToVtt(segments: TranscriptSegment[]): string {
  const stamp = (seconds: number) => {
    const s = Math.max(0, seconds);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    const ms = String(Math.round((s % 1) * 1000)).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
  };

  return (
    "WEBVTT\n\n" +
    segments
      .map((seg, i) => `${i + 1}\n${stamp(seg.start)} --> ${stamp(seg.end)}\n${seg.text}`)
      .join("\n\n")
  );
}

/** כל הכתוביות של ההפעלה, לפי מזהה קבוצה. */
export function useClipTranscripts(workshopId: string) {
  const [byGroup, setByGroup] = useState<Record<string, TranscriptSegment[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("responses")
        .select("group_id, data")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 7)
        .eq("type", "clip_transcript");
      if (cancelled || !data) return;
      const map: Record<string, TranscriptSegment[]> = {};
      for (const row of data) {
        const segments = (row.data as { segments?: TranscriptSegment[] })?.segments ?? [];
        if (segments.length > 0) map[row.group_id] = segments;
      }
      setByGroup(map);
    }

    load();
    // התמלול מגיע כמה שניות אחרי ההעלאה, ולכן בודקים שוב כמה פעמים.
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workshopId]);

  return byGroup;
}
