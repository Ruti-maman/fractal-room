import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";
import { requestKioskPermissions } from "../hooks/useKioskMode";
import StageShell from "./StageShell";
import Icon from "./ui/Icon";
import { GlassButton } from "./ui/Glass";

interface Props {
  screenNumber: number;
  myGroup: Group;
  stage: ProgramStage;
  onAdvance: () => void;
}

const STAGE_TYPE_LABEL: Record<string, string> = {
  independent: "עצמאי",
  parallel: "מקביל",
  shared: "משותף",
};

/**
 * תצוגת מציין-מקום לשלב שהתוכן האמיתי שלו עוד לא הגיע מהלקוחה (שלבים 9
 * ו-10 נכון להיום). מנוע השלבים כבר מחובר אליו במלואו - כפתור "הבא",
 * הטיימר, שער הסנכרון והסנכרון בזמן אמת עובדים - וכשיגיע התוכן מחליפים
 * רק את גוף המסך.
 *
 * העיצוב כאן אומר במפורש "זה עוד לא מוכן" ולא מנסה להעמיד פנים: כך אף
 * אחד לא מבלבל מסך זמני עם מסך גמור, ובבדיקה בחדר ברור מיד מה חסר.
 */
function PlaceholderStage({ screenNumber, stage, onAdvance }: Props) {
  function handleClick() {
    // מסך מלא ו-Wake Lock דורשים מחוות משתמשת - זו ההזדמנות הראשונה עד לכפתור "התחילו" האמיתי.
    requestKioskPermissions();
    onAdvance();
  }

  const description = (stage.content as { description?: string })?.description;

  return (
    <StageShell
      stage={stage.stage_number}
      kicker="בהכנה"
      icon="edit"
      title="השלב הזה עוד נבנה"
      subtitle={description}
      botanical="sprig"
      background="quiet"
      width="narrow"
      actions={
        <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={handleClick}>
          לשלב הבא
        </GlassButton>
      }
    >
      <div className="glass glass-brick flex w-full flex-col gap-4 rounded-xl p-6">
        <p className="text-ink-2 text-center leading-relaxed">
          מנוע השלבים כבר מחובר לשלב הזה. מה שחסר הוא התוכן עצמו, והוא ייכנס
          בלי לגעת בלוגיקה.
        </p>

        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "info" as const, label: "סוג", value: STAGE_TYPE_LABEL[stage.stage_type] ?? stage.stage_type },
            { icon: "users" as const, label: "שער סנכרון", value: stage.sync_gate ? "כן" : "לא" },
            { icon: "clock" as const, label: "משך", value: `${stage.duration_minutes ?? "-"} דק'` },
          ].map((item) => (
            <div key={item.label} className="glass glass-dim flex flex-col items-center gap-1 rounded-sm p-3">
              <Icon name={item.icon} size={16} className="text-accent-soft" />
              <dt className="text-ink-3 text-[11px] font-bold">{item.label}</dt>
              <dd className="text-ink text-sm font-extrabold">{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-ink-3 text-center text-xs">מסך {screenNumber}</p>
      </div>
    </StageShell>
  );
}

export default PlaceholderStage;
