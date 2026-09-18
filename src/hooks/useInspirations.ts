import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { InspirationItem } from "../types/stage3Content";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * שומרת ומסנכרנת את ההשראות של שלב 3 - משותפות לכל הקבוצות בהפעלה (לא לכל
 * קבוצה בנפרד), כי כולן עובדות יחד על אותה דילמה בשמש האסוציאציות. נשמר
 * בטבלת responses (type: "inspirations") לפי workshop_id בלבד, כדי ששלבים
 * הבאים (למשל שלב 4) יוכלו לקרוא את ה-4 הנבחרות (ראו סעיף 6 - responses כללית).
 */
export function useInspirations(workshopId: string, myGroupId: string) {
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const responseIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function refetch() {
      const { data } = await supabase
        .from("responses")
        .select("id, data")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 3)
        .eq("type", "inspirations")
        .maybeSingle();
      if (data) {
        responseIdRef.current = data.id;
        setItems((data.data as { items: InspirationItem[] }).items ?? []);
      }
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`inspirations-${workshopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "responses",
          filter: `workshop_id=eq.${workshopId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; stage_number: number; type: string; data: { items: InspirationItem[] } };
          if (row?.stage_number === 3 && row?.type === "inspirations") {
            responseIdRef.current = row.id;
            setItems(row.data.items ?? []);
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [workshopId]);

  async function save(newItems: InspirationItem[]) {
    setItems(newItems);
    if (responseIdRef.current) {
      await supabase
        .from("responses")
        .update({ data: { items: newItems } })
        .eq("id", responseIdRef.current)
        .then();
    } else {
      const { data } = await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: myGroupId,
          stage_number: 3,
          type: "inspirations",
          data: { items: newItems },
        })
        .select("id")
        .single();
      if (data) responseIdRef.current = data.id;
    }
  }

  return { items, loading, save };
}
