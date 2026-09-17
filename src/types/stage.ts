export type StageType = "independent" | "parallel" | "shared";

export interface ProgramStage {
  id: string;
  program_id: string;
  stage_number: number;
  stage_type: StageType;
  duration_minutes: number | null;
  sync_gate: boolean;
  content: Record<string, unknown>;
}
