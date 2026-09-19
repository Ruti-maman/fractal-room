import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { POLLING_INTERVAL_MS, SYNC_MODE } from "../lib/syncConfig";
import type { Group } from "../types/group";

interface Workshop {
  id: string;
  program_id: string;
  created_at: string;
  shared_stage_started_at: string | null;
  shared_stage_number: number | null;
}

interface ScreenData {
  loading: boolean;
  workshop: Workshop | null;
  myGroup: Group | null;
  allGroups: Group[];
  advanceMyStage: () => void;
}

/**
 * רשת ביטחון: גם כשמצב הסנכרון הוא "realtime", שולפים מחדש כל כמה שניות בכל מקרה.
 * זה נותן התאוששות אוטומטית אם שידור בודד הלך לאיבוד או שהחיבור נותק לרגע
 * (דרישה מסעיף 2 ב-CLAUDE.md), בלי לוותר על העדכון המיידי הרגיל של Realtime.
 */
const SAFETY_NET_INTERVAL_MS = 1500;

/** משווה שני מחרוזות timestamp לפי זמן אמיתי, לא כטקסט (פורמטים שונים יכולים להטעות השוואת מחרוזות). */
function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function useScreenData(screenNumber: number): ScreenData {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const workshopIdRef = useRef<string | null>(null);

  // שלב א: מוצאים את ההפעלה הפעילה (רק אחת יכולה להיות פעילה בכל רגע, ראו סעיף 6).
  useEffect(() => {
    supabase
      .from("workshops")
      .select("id, program_id, created_at, shared_stage_started_at, shared_stage_number")
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setWorkshop(data);
        if (!data) setLoading(false);
      });
  }, []);

  // שלב ב: טוענים קבוצות + הפעלה, ומתעדכנים בזמן אמת + רשת ביטחון של שליפה תקופתית.
  useEffect(() => {
    if (!workshop) return;
    const workshopId = workshop.id;
    workshopIdRef.current = workshopId;

    async function refetch() {
      const [groupsRes, workshopRes] = await Promise.all([
        supabase.from("groups").select("*").eq("workshop_id", workshopId),
        supabase
          .from("workshops")
          .select("id, program_id, created_at, shared_stage_started_at, shared_stage_number")
          .eq("id", workshopId)
          .single(),
      ]);
      // מיזוג בטוח: לא נותנים לתשובה "ישנה" (שנשלחה לפני עדכון מיידי מקומי) לדרוס אותו.
      if (groupsRes.data) {
        const fetched = groupsRes.data;
        setAllGroups((current) =>
          fetched.map((incoming) => {
            const existing = current.find((g) => g.id === incoming.id);
            if (existing && isNewer(existing.stage_started_at, incoming.stage_started_at)) {
              return existing;
            }
            return incoming;
          }),
        );
      }
      if (workshopRes.data) setWorkshop(workshopRes.data);
      setLoading(false);
    }

    refetch();

    // מצב polling מלא (fallback לרשת חסומה) - כתוב ב-src/lib/syncConfig.ts.
    if (SYNC_MODE === "polling") {
      const interval = setInterval(refetch, POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    // מצב realtime: WebSocket + רשת ביטחון של שליפה תקופתית ברקע.
    const safetyNet = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`workshop-${workshopId}-screen-${screenNumber}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groups",
          filter: `workshop_id=eq.${workshopId}`,
        },
        (payload) => {
          console.log(`[realtime screen ${screenNumber}] groups change:`, payload);
          setAllGroups((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((g) => g.id !== payload.old.id);
            }
            const updated = payload.new as Group;
            const existing = current.find((g) => g.id === updated.id);
            if (existing && isNewer(existing.stage_started_at, updated.stage_started_at)) {
              return current;
            }
            return existing
              ? current.map((g) => (g.id === updated.id ? updated : g))
              : [...current, updated];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workshops",
          filter: `id=eq.${workshopId}`,
        },
        (payload) => {
          console.log(`[realtime screen ${screenNumber}] workshop change:`, payload);
          setWorkshop(payload.new as Workshop);
        },
      )
      .subscribe((status, err) => {
        console.log(`[realtime screen ${screenNumber}] status:`, status, err ?? "");
      });

    return () => {
      clearInterval(safetyNet);
      supabase.removeChannel(channel);
    };
  }, [workshop?.id, screenNumber]);

  const myGroup =
    allGroups.find((g) => g.screen_number === screenNumber) ?? null;

  /**
   * מקדמת את הקבוצה שלי לשלב הבא - מעדכנת מיד על המסך שלי (בלי לחכות לשרת),
   * ובמקביל שומרת ב-Supabase ברקע. שאר המסכים יתעדכנו כרגיל דרך הסנכרון.
   */
  function advanceMyStage() {
    if (!myGroup) return;
    const nextStage = myGroup.current_stage + 1;
    const startedAt = new Date().toISOString();

    setAllGroups((current) =>
      current.map((g) =>
        g.id === myGroup.id
          ? { ...g, current_stage: nextStage, stage_started_at: startedAt }
          : g,
      ),
    );

    // חובה await/then כאן - בלי זה הבקשה ל-Supabase לא נשלחת בפועל (מתנהגת כ"עצלה").
    supabase
      .from("groups")
      .update({ current_stage: nextStage, stage_started_at: startedAt })
      .eq("id", myGroup.id)
      .then(({ error }) => {
        if (error) console.error("advanceMyStage failed:", error);
      });
  }

  return { loading, workshop, myGroup, allGroups, advanceMyStage };
}
