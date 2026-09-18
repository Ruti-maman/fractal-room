import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { InspirationItem } from "../types/stage3Content";

/**
 * שומרת את ההשראות של הקבוצה בשלב 3 בטבלת responses (type: "inspirations"),
 * כדי ששלבים הבאים (למשל שלב 4) יוכלו לקרוא את ה-4 הנבחרות (ראו סעיף 6 - responses כללית).
 */
export function useInspirations(workshopId: string, groupId: string) {
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const responseIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("group_id", groupId)
      .eq("stage_number", 3)
      .eq("type", "inspirations")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          responseIdRef.current = data.id;
          setItems((data.data as { items: InspirationItem[] }).items ?? []);
        }
        setLoading(false);
      });
  }, [workshopId, groupId]);

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
          group_id: groupId,
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
