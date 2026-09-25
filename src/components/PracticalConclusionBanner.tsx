import { useFunctioningPicture } from "../hooks/useFunctioningPicture";

interface Props {
  workshopId: string;
  groupId: string;
}

/**
 * "המסקנה המעשית" שהקבוצה עצמה הקלידה בשלב 4 (שקף 8, ראו
 * FunctioningPictureStep) מוצגת כרצועה קבועה בכל השלבים הבאים - לפי בקשת
 * הלקוחה: זו לא תוצאה חד-פעמית, אלא קלט שממשיך ללוות את שאר הסדנה (ראו
 * CLAUDE.md). קריאה בלבד - אין כאן generate, רק תצוגה של מה שכבר נשמר.
 * אם הקבוצה עוד לא הקלידה (או עוד לא הגיעה לשם) - לא מוצגת כלום.
 */
function PracticalConclusionBanner({ workshopId, groupId }: Props) {
  const { result, loading } = useFunctioningPicture(workshopId, groupId);

  if (loading || !result?.group_conclusion) return null;

  return (
    <div className="fixed top-3 left-1/2 z-20 flex w-[min(92vw,46rem)] -translate-x-1/2 items-baseline justify-center gap-3 rounded-full border border-wood/40 bg-smoke-blue-darker/90 px-6 py-2 text-center shadow-lg shadow-black/30 backdrop-blur-sm">
      <p className="shrink-0 text-[11px] font-bold text-white/45">מסקנה מעשית</p>
      <p className="truncate text-sm font-bold text-white">{result.group_conclusion}</p>
    </div>
  );
}

export default PracticalConclusionBanner;
