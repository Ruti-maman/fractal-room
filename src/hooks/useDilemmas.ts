import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Dilemma } from "../types/dilemma";

const COLUMNS = "id, program_id, sort_order, title, summary, profile_text, video_url";

/** כל הדילמות בספרייה של תוכנית, לפי הסדר (למסך הבחירה ב-/admin). */
export function useDilemmaLibrary(programId: string | undefined) {
  const [dilemmas, setDilemmas] = useState<Dilemma[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!programId) {
      setDilemmas([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("dilemmas")
      .select(COLUMNS)
      .eq("program_id", programId)
      .order("sort_order", { ascending: true });
    setDilemmas((data as Dilemma[] | null) ?? []);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { dilemmas, loading, reload };
}

/** הדילמה שנבחרה להפעלה (workshops.dilemma_id). null = לא נבחרה, ואז הסדנה משתמשת בתוכן השלבים. */
export function useDilemma(dilemmaId: string | null | undefined) {
  const [dilemma, setDilemma] = useState<Dilemma | null>(null);
  const [loading, setLoading] = useState(Boolean(dilemmaId));

  useEffect(() => {
    if (!dilemmaId) {
      setDilemma(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    supabase
      .from("dilemmas")
      .select(COLUMNS)
      .eq("id", dilemmaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setDilemma((data as Dilemma | null) ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dilemmaId]);

  return { dilemma, loading };
}
