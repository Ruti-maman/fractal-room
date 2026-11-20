/*
 * תצוגה מקדימה של כל שלב בסדנה - בשרת הפיתוח בלבד (2026-11-14).
 *
 * למה: כדי לעצב את כל השלבים בשפה החדשה צריך לראות כל אחד מהם, בלי להזיז
 * את הקבוצות האמיתיות בסדנה הפעילה. כאן התוכן אמיתי (שלבי התוכנית
 * הפעילה, **קריאה בלבד**), אבל ההפעלה והקבוצות מדומות - מזהים שלא קיימים
 * במסד. כל כתיבה (התקדמות, שמירה, הקלטה) נדחית בשקט ולא משנה כלום.
 *
 * כתובת: /preview/stage?n=3 (ואפשר &screen=2). רשום ב-App.tsx רק ב-DEV.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useProgramStages } from "../hooks/useProgramStages";
import { useDilemmaLibrary } from "../hooks/useDilemmas";
import { applyDilemma } from "../lib/applyDilemma";
import StageRouter from "../components/StageRouter";
import type { Group } from "../types/group";

/** מזהה שלא קיים במסד: קריאות מחזירות ריק, כתיבות נכשלות */
const FAKE_WORKSHOP = "00000000-0000-4000-8000-000000000000";
const NAMES = ["המגדלור", "גשר חדש", "צבעי מים"];

export default function StagePreview() {
  const params = new URLSearchParams(window.location.search);
  const n = Number(params.get("n")) || 2;
  const screen = Number(params.get("screen")) || 1;
  const navigate = useNavigate();
  const [programId, setProgramId] = useState<string | undefined>();
  const [activeDilemmaId, setActiveDilemmaId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("workshops")
      .select("program_id, dilemma_id")
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { program_id?: string; dilemma_id?: string | null } | undefined;
        setProgramId(row?.program_id);
        setActiveDilemmaId(row?.dilemma_id ?? null);
      });
  }, []);
  const { stages: programStages } = useProgramStages(programId);
  // הדילמה: &dilemma=3 - הדילמה השלישית בספרייה; בלי - זו שנבחרה להפעלה הפעילה
  const { dilemmas } = useDilemmaLibrary(programId);
  const pickN = Number(params.get("dilemma"));
  const dilemma =
    (pickN ? dilemmas.find((d) => d.sort_order === pickN) : dilemmas.find((d) => d.id === activeDilemmaId)) ?? null;
  const stages = applyDilemma(programStages, dilemma);

  const startedAt = new Date().toISOString();
  const groups: Group[] = [1, 2, 3].map((s) => ({
    id: `00000000-0000-4000-8000-00000000000${s}`,
    workshop_id: FAKE_WORKSHOP,
    screen_number: s,
    name: NAMES[s - 1],
    // &behind=1: שאר הקבוצות שלב אחד אחורה - כדי לראות את מסך ההמתנה בשלבים משותפים
    current_stage: params.get("behind") && s !== screen ? n - 1 : n,
    stage_started_at: startedAt,
  }));
  const me = groups[screen - 1];

  if (stages.length === 0) return null;
  const numbers = stages.map((s) => s.stage_number).sort((a, b) => a - b);
  const keepDilemma = params.get("dilemma") ? `&dilemma=${params.get("dilemma")}` : "";
  const go = (to: number | undefined) => to && navigate(`/preview/stage?n=${to}&screen=${screen}${keepDilemma}`);

  return (
    <StageRouter
      key={n}
      screenNumber={screen}
      myGroup={me}
      allGroups={groups}
      stages={stages}
      workshopId={FAKE_WORKSHOP}
      workshopCreatedAt={startedAt}
      sharedStageStartedAt={startedAt}
      sharedStageNumber={n}
      onAdvance={() => go(numbers.find((x) => x > n))}
      onGoBack={() => go([...numbers].reverse().find((x) => x < n))}
    />
  );
}
