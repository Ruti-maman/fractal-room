import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { InspirationItem } from "../types/stage3Content";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * שומרת ומסנכרנת את ההשראות של שלב 3 - משותפות לכל הקבוצות בהפעלה (לא לכל
 * קבוצה בנפרד), כי כולן עובדות יחד על אותה דילמה בשמש האסוציאציות. נשמר
 * בטבלת responses (type: "inspirations") לפי workshop_id בלבד, כדי ששלבים
 * הבאים (למשל שלב 4) יוכלו לקרוא את ה-4 הנבחרות (ראו סעיף 6 - responses כללית).
 *
 * כל שינוי (mutate) קורא קודם את המצב העדכני ביותר מהשרת ורק אז כותב -
 * כדי שכמה מסכים שכותבים כמעט בו-זמנית לא יידרסו אחד את השני ולא ייצרו שורות כפולות.
 */
export function useInspirations(workshopId: string) {
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRow() {
    return supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 3)
      .eq("type", "inspirations")
      .maybeSingle();
  }

  useEffect(() => {
    async function refetch() {
      const { data } = await fetchRow();
      if (data) setItems((data.data as { items: InspirationItem[] }).items ?? []);
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`inspirations-${workshopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        (payload) => {
          const row = payload.new as { stage_number: number; type: string; data: { items: InspirationItem[] } };
          if (row?.stage_number === 3 && row?.type === "inspirations") {
            setItems(row.data.items ?? []);
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  /** קוראת את המצב העדכני מהשרת, מפעילה עליו mutate, וכותבת בחזרה - בלי להסתמך על מידע מקומי ישן. */
  async function mutate(defaultGroupId: string, mutateFn: (current: InspirationItem[]) => InspirationItem[]) {
    const { data } = await fetchRow();
    const current = data ? ((data.data as { items: InspirationItem[] }).items ?? []) : [];
    const next = mutateFn(current);
    setItems(next);

    if (data) {
      await supabase.from("responses").update({ data: { items: next } }).eq("id", data.id).then();
    } else {
      await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: defaultGroupId,
          stage_number: 3,
          type: "inspirations",
          data: { items: next },
        })
        .then();
    }
  }

  return { items, loading, mutate };
}
