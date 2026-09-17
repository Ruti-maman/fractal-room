import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Group } from "../types/group";

interface ScreenData {
  loading: boolean;
  workshopId: string | null;
  myGroup: Group | null;
  allGroups: Group[];
}

export function useScreenData(screenNumber: number): ScreenData {
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // שלב א: מוצאים את ההפעלה הפעילה (רק אחת יכולה להיות פעילה בכל רגע, ראו סעיף 6).
  useEffect(() => {
    supabase
      .from("workshops")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setWorkshopId(data?.id ?? null);
        if (!data) setLoading(false);
      });
  }, []);

  // שלב ב: טוענים את כל הקבוצות של ההפעלה, ונרשמים לעדכונים בזמן אמת עליהן.
  useEffect(() => {
    if (!workshopId) return;

    supabase
      .from("groups")
      .select("*")
      .eq("workshop_id", workshopId)
      .then(({ data }) => {
        setAllGroups(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`groups-${workshopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groups",
          filter: `workshop_id=eq.${workshopId}`,
        },
        (payload) => {
          setAllGroups((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((g) => g.id !== payload.old.id);
            }
            const updated = payload.new as Group;
            const exists = current.some((g) => g.id === updated.id);
            return exists
              ? current.map((g) => (g.id === updated.id ? updated : g))
              : [...current, updated];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workshopId]);

  const myGroup =
    allGroups.find((g) => g.screen_number === screenNumber) ?? null;

  return { loading, workshopId, myGroup, allGroups };
}
