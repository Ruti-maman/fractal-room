import { useState } from "react";
import { useFunctioningPicture } from "../hooks/useFunctioningPicture";
import Icon from "./ui/Icon";
import GlassModal from "./ui/GlassModal";

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
 *
 * ----------------------------------------------------------------------------
 * למה הרצועה נפתחת בלחיצה
 * ----------------------------------------------------------------------------
 * המסקנה היא משפט שלם שהקבוצה ניסחה, והרצועה הצרה בראש המסך חתכה אותו
 * באמצע (`truncate`) - כלומר בדיוק הטקסט שאמור ללוות את הקבוצה עד הסוף
 * היה זה שאי אפשר לקרוא. עכשיו הרצועה היא כפתור: נשארת דקה ולא גוזלת
 * מקום מהשלב, ובלחיצה נפתחת ללבנת זכוכית עם המשפט המלא.
 */
function PracticalConclusionBanner({ workshopId, groupId }: Props) {
  const { result, loading } = useFunctioningPicture(workshopId, groupId);
  const [open, setOpen] = useState(false);

  if (loading || !result?.group_conclusion) return null;

  const conclusion = result.group_conclusion;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`המסקנה המעשית שלנו: ${conclusion}. לחצו להצגה מלאה`}
        className="glass glass-interactive glass-pill max-w-[min(58vw,40rem)] gap-2.5 py-2 ps-4 pe-3"
      >
        <Icon name="lightbulb" size={17} className="text-accent-soft flex-none" />
        <span className="text-ink-3 flex-none text-[10px] font-bold tracking-wide">
          המסקנה שלנו
        </span>
        <span className="text-ink min-w-0 truncate text-sm font-bold">{conclusion}</span>
        <Icon name="chevronDown" size={15} className="text-ink-3 flex-none" />
      </button>

      <GlassModal
        open={open}
        onClose={() => setOpen(false)}
        title="המסקנה המעשית שלנו"
        icon="lightbulb"
        cancelLabel="סגירה"
      >
        <p className="text-ink text-2xl leading-relaxed font-bold">{conclusion}</p>
        <p className="text-ink-3 mt-5 text-sm">
          ניסחתן אותה בשלב 4, והיא מלווה אתכן עד סוף הסדנה.
        </p>
      </GlassModal>
    </>
  );
}

export default PracticalConclusionBanner;
