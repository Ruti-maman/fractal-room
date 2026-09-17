import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { ProgramStage } from "../types/stage";

export function useProgramStages(programId: string | undefined) {
  const [stages, setStages] = useState<ProgramStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    supabase
      .from("program_stages")
      .select("*")
      .eq("program_id", programId)
      .order("stage_number")
      .then(({ data }) => {
        setStages(data ?? []);
        setLoading(false);
      });
  }, [programId]);

  return { stages, loading };
}
