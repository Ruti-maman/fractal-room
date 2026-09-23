import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type MarkColor = "green" | "red" | null;

/** קטע טקסט רציף שסומן ותויג בקטגוריה - נוצר ברגע שמסיימים גרירה על טקסט לא-מסומן. */
export interface TaggedPhrase {
  id: string;
  color: "green" | "red";
  category: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface MarkingState {
  marks: MarkColor[];
  phrases: TaggedPhrase[];
}

const SAFETY_NET_INTERVAL_MS = 1500;
const EMPTY_STATE: MarkingState = { marks: [], phrases: [] };

/**
 * סימוני המרקר (ירוק=חוזקות, אדום=חסמים) על טקסט הפרופיל בשלב 4 - נפרד
 * לכל קבוצה, כי כאן (בשונה משלב 3) כל קבוצה מסמנת בעצמה את הטקסט שלה.
 * marks[i] הוא הצבע של האות מספר i בטקסט, לא ספירת רווחים (או null אם לא סומנה).
 * הסימון ברמת אות ולא ברמת מילה שלמה, כדי שהגרירה תדגיש בדיוק את מה
 * שהאצבע עברה עליו - כמו מרקר אמיתי, לא קפיצה מיידית למילה שלמה.
 *
 * phrases הם הקטעים הרציפים שכבר תויגו בקטגוריה (שקף 7 - טבלת הסנכרון):
 * כל קטע נוצר ומתויג ברגע שמסתיימת גרירה שצבעה טקסט חדש, לא בדיעבד.
 *
 * מחזירה mutate שכותב את כל המצב (marks+phrases) בבת אחת - הקומפוננטה אוגרת
 * שינויים מקומית תוך כדי גרירה ושומרת רק פעם אחת בסיום הגרירה, כדי לא
 * להציף את השרת בכתיבות.
 */
export function useTextMarking(workshopId: string, groupId: string) {
  const [state, setState] = useState<MarkingState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  // דוחה תשובות "ישנות": אם גרירה מהירה כותבת פעמיים ברצף, יש סיכוי של ממש
  // שה-poll התקופתי (לא ה-mutate עצמו, שכבר קורא טרי לפני כתיבה) יחזיר תשובה
  // מלפני הכתיבה השנייה אחרי שהיא כבר הסתיימה, וידרוס בטעות מצב עדכני בישן.
  // כל refetch/mutate נרשם עם מספר סידורי, ותשובה שהגיעה אחרי שמישהי חדשה
  // ממנה כבר התחילה - מתעלמים ממנה.
  const latestOpRef = useRef(0);

  async function fetchRow() {
    // .order+limit(1) ולא .maybeSingle(): אם משום מה נוצרו בטעות כמה שורות
    // (למשל התנגשות כתיבה נדירה), עדיף להמשיך לעבוד על הוותיקה שבהן באופן
    // יציב, לא ליפול לשגיאה שגורמת לכל mutate הבא ליצור עוד שורה כפולה.
    const { data, error } = await supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 4)
      .eq("type", "text_marking")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(1);
    return { data: data?.[0] ?? null, error };
  }

  function readState(data: { marks?: MarkColor[]; phrases?: TaggedPhrase[] } | undefined): MarkingState {
    return { marks: data?.marks ?? [], phrases: data?.phrases ?? [] };
  }

  useEffect(() => {
    async function refetch() {
      const opId = ++latestOpRef.current;
      const { data } = await fetchRow();
      if (opId !== latestOpRef.current) return; // מישהי חדשה יותר (mutate או refetch) כבר התחילה - זו תשובה ישנה
      if (data) setState(readState(data.data as { marks?: MarkColor[]; phrases?: TaggedPhrase[] }));
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`text-marking-${workshopId}-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        (payload) => {
          const row = payload.new as {
            stage_number: number;
            type: string;
            group_id: string;
            data: { marks?: MarkColor[]; phrases?: TaggedPhrase[] };
          };
          if (row?.stage_number === 4 && row?.type === "text_marking" && row?.group_id === groupId) {
            setState(readState(row.data));
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId, groupId]);

  async function mutate(mutateFn: (current: MarkingState) => MarkingState) {
    latestOpRef.current++; // כל refetch שכבר בדרך (כולל ה-poll התקופתי) הופך מיושן מהרגע הזה
    const { data } = await fetchRow();
    const current = readState(data?.data as { marks?: MarkColor[]; phrases?: TaggedPhrase[] } | undefined);
    const next = mutateFn(current);
    setState(next);

    if (data) {
      await supabase.from("responses").update({ data: next }).eq("id", data.id).then();
    } else {
      await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: groupId,
          stage_number: 4,
          type: "text_marking",
          data: next,
        })
        .then();
    }
  }

  return { marks: state.marks, phrases: state.phrases, loading, mutate };
}
