import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 1500;

interface RatingRow {
  id: string;
  group_id: string;
  data: { ratings: Record<string, number> };
}

/**
 * דירוגי כוכבים לסרטוני שלב 7 - כל קבוצה שומרת שורה משלה (מי היא מדרגת),
 * עם הדירוג שהיא נתנה לכל קבוצה אחרת. שלב 8 ממצע את כל השורות לפי קבוצה מדורגת.
 */
export function useRatings(workshopId: string, myGroupId: string) {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const myResponseIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function refetch() {
      const { data } = await supabase
        .from("responses")
        .select("id, group_id, data")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 7)
        .eq("type", "video_rating");
      if (data) {
        setRows(data as RatingRow[]);
        const mine = data.find((r) => r.group_id === myGroupId);
        if (mine) myResponseIdRef.current = mine.id;
      }
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);
    const channel = supabase
      .channel(`ratings-${workshopId}`)
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
  }, [workshopId, myGroupId]);

  const myRatings = rows.find((r) => r.group_id === myGroupId)?.data.ratings ?? {};

  async function rate(ratedGroupId: string, stars: number) {
    const newRatings = { ...myRatings, [ratedGroupId]: stars };
    if (myResponseIdRef.current) {
      await supabase
        .from("responses")
        .update({ data: { ratings: newRatings } })
        .eq("id", myResponseIdRef.current)
        .then();
    } else {
      const { data } = await supabase
        .from("responses")
        .insert({
          workshop_id: workshopId,
          group_id: myGroupId,
          stage_number: 7,
          type: "video_rating",
          data: { ratings: newRatings },
        })
        .select("id")
        .single();
      if (data) myResponseIdRef.current = data.id;
    }
  }

  return { rows, myRatings, rate };
}
