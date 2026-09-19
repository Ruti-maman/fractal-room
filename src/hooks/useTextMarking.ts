import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type MarkColor = "green" | "red" | null;

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * סימוני המרקר (ירוק=חוזקות, אדום=חסמים) על טקסט הפרופיל בשלב 4 - נפרד
 * לכל קבוצה, כי כאן (בשונה משלב 3) כל קבוצה מסמנת בעצמה את הטקסט שלה.
 * marks[i] הוא הצבע של מילה מספר i (או null אם לא סומנה).
 *
 * מחזירה mutate שכותב את כל המערך בבת אחת - הקומפוננטה אוגרת שינויים מקומית
 * תוך כדי גרירה ושומרת רק פעם אחת בסיום הגרירה, כדי לא להציף את השרת בכתיבות.
 */
export function useTextMarking(workshopId: string, groupId: string) {
  const [marks, setMarks] = useState<MarkColor[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function refetch() {
      const { data } = await fetchRow();
      if (data) setMarks((data.data as { marks: MarkColor[] }).marks ?? []);
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
            data: { marks: MarkColor[] };
          };
          if (row?.stage_number === 4 && row?.type === "text_marking" && row?.group_id === groupId) {
            setMarks(row.data.marks ?? []);
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

  async function mutate(mutateFn: (current: MarkColor[]) => MarkColor[]) {
    const { data } = await fetchRow();
    const current = data ? ((data.data as { marks: MarkColor[] }).marks ?? []) : [];
    const next = mutateFn(current);
    setMarks(next);

    if (data) {
      await supabase.from("responses").update({ data: { marks: next } }).eq("id", data.id).then();
    } else {
      await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: groupId,
          stage_number: 4,
          type: "text_marking",
          data: { marks: next },
        })
        .then();
    }
  }

  return { marks, loading, mutate };
}
