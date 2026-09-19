import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * שלושת העקרונות המנחים של שלב 10 - משותפים לכל הקבוצות (כל הסדנה מנסחת
 * יחד), אותו דפוס בטוח-למרוץ-תזמון כמו ההשראות של שלב 3 (ראו useInspirations.ts):
 * קוראים מחדש מהשרת ממש לפני כל כתיבה, לא מסתמכים על state מקומי ישן.
 */
export function usePrinciples(workshopId: string, myGroupId: string) {
  const [principles, setPrinciples] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState(true);

  async function fetchRow() {
    return supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 10)
      .eq("type", "principles")
      .order("created_at")
      .limit(1)
      .maybeSingle();
  }

  useEffect(() => {
    async function refetch() {
      const { data } = await fetchRow();
      if (data) setPrinciples((data.data as { principles: string[] }).principles ?? ["", "", ""]);
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`principles-${workshopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        (payload) => {
          const row = payload.new as { stage_number: number; type: string; data: { principles: string[] } };
          if (row?.stage_number === 10 && row?.type === "principles") {
            setPrinciples(row.data.principles ?? ["", "", ""]);
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

  async function updatePrinciple(index: number, text: string) {
    const { data } = await fetchRow();
    const current = data ? ((data.data as { principles: string[] }).principles ?? ["", "", ""]) : ["", "", ""];
    const next = current.slice();
    next[index] = text;
    setPrinciples(next);

    if (data) {
      await supabase.from("responses").update({ data: { principles: next } }).eq("id", data.id).then();
    } else {
      await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: myGroupId,
          stage_number: 10,
          type: "principles",
          data: { principles: next },
        })
        .then();
    }
  }

  return { principles, loading, updatePrinciple };
}
