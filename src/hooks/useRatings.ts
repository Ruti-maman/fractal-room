import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * מבנה הנתונים החדש: לכל קבוצה מדורגת נשמר **מערך הצבעות** ולא מספר אחד,
 * כי כל בת בקבוצה מצביעה בעצמה פעם אחת (ראו הכלל ב-Stage7Simulation).
 * המבנה הישן - ratings: { groupId: stars } - נשמר בהפעלות קודמות, ולכן
 * normalizeVotes ממירה אותו להצבעה בודדת. כך שלב 8 ממשיך לעבוד על נתונים ישנים.
 */
export interface RatingData {
  votes?: Record<string, number[]>;
  ratings?: Record<string, number>;
}

export interface RatingRow {
  id: string;
  group_id: string;
  data: RatingData;
}

export function normalizeVotes(data: RatingData): Record<string, number[]> {
  if (data?.votes) return data.votes;
  const legacy = data?.ratings ?? {};
  const converted: Record<string, number[]> = {};
  for (const [groupId, stars] of Object.entries(legacy)) converted[groupId] = [stars];
  return converted;
}

/**
 * דירוגי כוכבים לסרטוני שלב 7. כל מסך שומר שורה אחת משלו, ובתוכה ההצבעות
 * שהבנות שלו נתנו לכל אחת מהקבוצות.
 *
 * הכתיבות מ**אותו מסך** מסודרות בתור (writeQueueRef): כמה בנות לוחצות בזו
 * אחר זו תוך שניות, וכתיבה שמסתמכת על מצב מקומי מיושן הייתה מוחקת הצבעה של
 * מי שלחצה קודם. לכן כל כתיבה קוראת מחדש מהשרת ממש לפניה ומוסיפה לסוף -
 * אותו לקח שמתועד בסעיף 8.5 ב-CLAUDE.md לגבי כתיבות משותפות.
 */
export function useRatings(workshopId: string, myGroupId: string) {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const myResponseIdRef = useRef<string | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // הצבעות שנשלחו ועוד לא חזרו מהשרת - כדי שהמסך יגיב מיד ללחיצה
  const [pending, setPending] = useState<Record<string, number[]>>({});

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
        if (mine) {
          myResponseIdRef.current = mine.id;
          // מה שכבר הגיע מהשרת לא צריך להישאר ב"ממתין"
          setPending((current) => {
            const server = normalizeVotes((mine as RatingRow).data);
            const next: Record<string, number[]> = {};
            for (const [groupId, votes] of Object.entries(current)) {
              const extra = votes.length - (server[groupId]?.length ?? 0);
              if (extra > 0) next[groupId] = votes.slice(-extra);
            }
            return next;
          });
        }
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

  const serverVotes = normalizeVotes(rows.find((r) => r.group_id === myGroupId)?.data ?? {});

  /** ההצבעות של המסך הזה, כולל אלה שעוד בדרך לשרת. */
  const myVotes: Record<string, number[]> = { ...serverVotes };
  for (const [groupId, votes] of Object.entries(pending)) {
    myVotes[groupId] = [...(myVotes[groupId] ?? []), ...votes];
  }

  const castVote = useCallback(
    (ratedGroupId: string, stars: number) => {
      setPending((current) => ({
        ...current,
        [ratedGroupId]: [...(current[ratedGroupId] ?? []), stars],
      }));

      writeQueueRef.current = writeQueueRef.current.then(async () => {
        // קריאה טרייה מהשרת ממש לפני הכתיבה, ולא הסתמכות על מצב מקומי
        const { data: existing } = await supabase
          .from("responses")
          .select("id, data")
          .eq("workshop_id", workshopId)
          .eq("group_id", myGroupId)
          .eq("stage_number", 7)
          .eq("type", "video_rating")
          .maybeSingle();

        if (existing) {
          const votes = normalizeVotes(existing.data as RatingData);
          votes[ratedGroupId] = [...(votes[ratedGroupId] ?? []), stars];
          myResponseIdRef.current = existing.id;
          await supabase.from("responses").update({ data: { votes } }).eq("id", existing.id).then();
        } else {
          const { data: created } = await supabase
            .from("responses")
            .insert({
              workshop_id: workshopId,
              group_id: myGroupId,
              stage_number: 7,
              type: "video_rating",
              data: { votes: { [ratedGroupId]: [stars] } },
            })
            .select("id")
            .single();
          if (created) myResponseIdRef.current = created.id;
        }
      });
    },
    [workshopId, myGroupId],
  );

  // pending מוחזר כדי שהמונה על המסך יקפוץ מיד בלחיצה ולא ימתין לסבב השרת
  return { rows, myVotes, pending, castVote };
}
