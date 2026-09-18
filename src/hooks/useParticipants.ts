import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Participant } from "../types/participant";

const SAFETY_NET_INTERVAL_MS = 2000;

/** שולפת ומסנכרנת את המשתתפות של קבוצות נתונות (לתצוגת "מצב חדר" בשלב 2). */
export function useParticipants(groupIds: string[]) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const idsKey = groupIds.slice().sort().join(",");

  useEffect(() => {
    if (groupIds.length === 0) return;

    async function refetch() {
      const { data } = await supabase
        .from("participants")
        .select("*")
        .in("group_id", groupIds);
      if (data) setParticipants(data);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`participants-${idsKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => refetch(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return participants;
}
