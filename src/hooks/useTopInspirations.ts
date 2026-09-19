import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * מחשבת אילו השראות משלב 3 נבחרו הכי הרבה בסך הכל, אצל כל הקבוצות יחד (לא
 * רק אצל הקבוצה שלנו) - לתיבה "4 ההשראות מהסעיף הקודם" בראש שלב 4 (שקף 6
 * במצגת). ממוינת מהכי-נבחרת למעלה.
 *
 * קוראת גם את טקסט ההשראות המשותף (useInspirations) וגם את כל שורות הבחירה
 * הנפרדות של כל קבוצה (useInspirationSelection, אחת לכל group_id) ומצרפת.
 */
export function useTopInspirations(workshopId: string, limit = 4) {
  const [top, setTop] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function refetch() {
      const [{ data: textRow }, { data: selectionRows }] = await Promise.all([
        supabase
          .from("responses")
          .select("data")
          .eq("workshop_id", workshopId)
          .eq("stage_number", 3)
          .eq("type", "inspirations")
          .maybeSingle(),
        supabase
          .from("responses")
          .select("data")
          .eq("workshop_id", workshopId)
          .eq("stage_number", 3)
          .eq("type", "inspirations_selection"),
      ]);

      const items = (textRow?.data as { items?: { text: string }[] } | null)?.items ?? [];
      const counts = new Array(items.length).fill(0);
      for (const row of selectionRows ?? []) {
        const selected = (row.data as { selected?: number[] })?.selected ?? [];
        for (const index of selected) {
          if (counts[index] !== undefined) counts[index] += 1;
        }
      }

      const ranked = counts
        .map((count, index) => ({ index, count, text: items[index]?.text ?? "" }))
        .filter((r) => r.text.trim() && r.count > 0)
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .slice(0, limit)
        .map((r) => r.text);

      setTop(ranked);
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`top-inspirations-${workshopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        () => refetch(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId, limit]);

  return { top, loading };
}
