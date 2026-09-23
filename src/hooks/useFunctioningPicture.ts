import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export interface FunctioningPictureResult {
  sentence1: string;
  sentence2: string;
  /** המסקנה המעשית שהקבוצה עצמה מקלידה (שקף 8) - זו שממשיכה ללוות את השלבים הבאים, לא AI. */
  group_conclusion?: string;
}

const SAFETY_NET_INTERVAL_MS = 1500;

/**
 * "תמונת תפקוד כוללת" (שקף 8, שלב 4 המשך) - שני משפטי הניסוח (sentence1/2)
 * נוצרים פעם אחת ב-AI (Google Gemini, ראו
 * supabase/functions/generate-functioning-picture) על סמך ההשראות
 * המשותפות משלב 3 והביטויים המתויגים של הקבוצה עצמה משלב 4. ה-Edge
 * Function עצמה שולפת את הנתונים ושומרת את התוצאה ב-responses (type
 * "functioning_picture", לפי group_id) - הפונקציה כאן רק קוראת אותה
 * וקוראת ל-generate פעם אחת.
 *
 * המסקנה המעשית (group_conclusion) היא לא AI - הקבוצה מקלידה אותה בעצמה
 * (ראו FunctioningPictureStep ב-Stage4Analysis.tsx), ונשמרת דרך
 * saveGroupConclusion לתוך אותה שורה.
 *
 * נקראת בשני מקומות: במסך "תמונת תפקוד" עצמו בתוך שלב 4 (עם generate
 * ו-saveGroupConclusion), ובכל שלב אחרי זה דרך PracticalConclusionBanner
 * (קריאה בלבד) - לפי ההחלטה שהמסקנה המעשית "מלווה את כל השלבים הבאים"
 * (ראו CLAUDE.md).
 */
export function useFunctioningPicture(workshopId: string, groupId: string) {
  const [result, setResult] = useState<FunctioningPictureResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestOpRef = useRef(0);

  async function fetchRow() {
    const { data } = await supabase
      .from("responses")
      .select("data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 4)
      .eq("type", "functioning_picture")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(1);
    return (data?.[0]?.data as FunctioningPictureResult | undefined) ?? null;
  }

  useEffect(() => {
    async function refetch() {
      const opId = ++latestOpRef.current;
      const row = await fetchRow();
      if (opId !== latestOpRef.current) return; // תשובה ישנה - כבר יש חדשה יותר בדרך
      setResult(row);
      setLoading(false);
    }

    refetch();
    const interval = setInterval(refetch, SAFETY_NET_INTERVAL_MS);

    const channel = supabase
      .channel(`functioning-picture-${workshopId}-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `workshop_id=eq.${workshopId}` },
        (payload) => {
          const row = payload.new as {
            stage_number: number;
            type: string;
            group_id: string;
            data: FunctioningPictureResult;
          };
          if (row?.stage_number === 4 && row?.type === "functioning_picture" && row?.group_id === groupId) {
            setResult(row.data);
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId, groupId]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-functioning-picture", {
        body: { workshop_id: workshopId, group_id: groupId },
      });
      if (fnError) throw fnError;
      setResult(data as FunctioningPictureResult);
    } catch {
      setError("לא הצלחנו לייצר את תמונת התפקוד. אפשר לנסות שוב.");
    } finally {
      setGenerating(false);
    }
  }

  /** שומרת את המסקנה המעשית שהקבוצה הקלידה בעצמה, בתוך אותה שורה שכבר נוצרה ב-generate. */
  async function saveGroupConclusion(groupConclusion: string) {
    const { data } = await supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshopId)
      .eq("stage_number", 4)
      .eq("type", "functioning_picture")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(1);
    const row = data?.[0];
    if (!row) return;
    const nextData = { ...(row.data as FunctioningPictureResult), group_conclusion: groupConclusion };
    await supabase.from("responses").update({ data: nextData }).eq("id", row.id);
    setResult(nextData);
  }

  return { result, loading, generating, error, generate, saveGroupConclusion };
}
