import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";

interface Props {
  screenNumber: number;
  myGroup: Group;
  stage: ProgramStage;
  onAdvance: () => void;
}

/**
 * תצוגת מציין-מקום זמנית לתוכן שלב - עד שנבנה את השלבים האמיתיים (משימה 5).
 * מטרתה כרגע היא רק להוכיח שמנוע השלבים עצמו (כפתור "הבא", מעבר, סנכרון) עובד.
 */
function PlaceholderStage({ screenNumber, stage, onAdvance }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">מסך {screenNumber}</h1>
      <p className="text-lg">
        שלב {stage.stage_number} ({stage.stage_type})
        {stage.sync_gate && " - שער סנכרון"}
      </p>
      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-8 py-4 text-xl font-bold transition-transform duration-100 active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

export default PlaceholderStage;
