import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { MediaItem } from "../types/media";

const SAFETY_NET_INTERVAL_MS = 1500;

/** שולפת ומסנכרנת את קבצי המדיה (סרטוני סימולציה) של שלב נתון בהפעלה. */
export function useMedia(workshopId: string, stageNumber: number) {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    async function refetch() {
      const { data } = await supabase
        .from("media")
        .select("*")
        .eq("workshop_id", workshopId)
        .eq("stage_number", stageNumber);
      if (data) setItems(data);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`media-${workshopId}-${stageNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "media", filter: `workshop_id=eq.${workshopId}` },
        () => refetch(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [workshopId, stageNumber]);

  return items;
}
