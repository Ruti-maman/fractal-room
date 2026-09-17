export interface Group {
  id: string;
  workshop_id: string;
  screen_number: number;
  name: string | null;
  current_stage: number;
  stage_started_at: string;
}
