import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * בחירת ההשראות בשלב 3 - נפרדת לכל קבוצה (בשונה מטקסט ההשראות עצמו, שמשותף -
 * ראו useInspirations). נשמרת בשורת responses ייחודית לכל קבוצה
 * (type: "inspirations_selection", group_id: הקבוצה), כדי שקבוצה אחת לא תראה
 * או תדרוס את הבחירה של קבוצה אחרת, והמעבר לשלב הבא (אחרי 4 בחירות) יקרה
 * לכל קבוצה בנפרד לפי הבחירות שלה בלבד.
 *
 * מחזירה מערך אינדקסים (0-6) לפי סדר הבחירה - כדי שהסטריפ למטה יציג אותן
 * לפי הסדר שבו הקבוצה בחרה, לא לפי מיקום הקרן בשמש.
 */
export function useInspirationSelection(workshopId: string, groupId: string) {
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRow() {
    return supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 3)
      .eq("type", "inspirations_selection")
      .eq("group_id", groupId)
      .maybeSingle();
  }

  useEffect(() => {
    async function refetch() {
      const { data } = await fetchRow();
      if (data) setSelected((data.data as { selected: number[] }).selected ?? []);
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`inspiration-selection-${workshopId}-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        (payload) => {
          const row = payload.new as {
            stage_number: number;
            type: string;
            group_id: string;
            data: { selected: number[] };
          };
          if (
            row?.stage_number === 3 &&
            row?.type === "inspirations_selection" &&
            row?.group_id === groupId
          ) {
            setSelected(row.data.selected ?? []);
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

  /** קוראת את המצב העדכני מהשרת, מפעילה עליו mutate, וכותבת בחזרה. */
  async function mutate(mutateFn: (current: number[]) => number[]) {
    const { data } = await fetchRow();
    const current = data ? ((data.data as { selected: number[] }).selected ?? []) : [];
    const next = mutateFn(current);
    setSelected(next);

    if (data) {
      await supabase.from("responses").update({ data: { selected: next } }).eq("id", data.id).then();
    } else {
      await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: groupId,
          stage_number: 3,
          type: "inspirations_selection",
          data: { selected: next },
        })
        .then();
    }
  }

  return { selected, loading, mutate };
}
