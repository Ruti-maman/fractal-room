import type { Group } from "../types/group";
import { cx } from "../lib/cx";
import StageShell from "./StageShell";
import Icon from "./ui/Icon";

interface Props {
  stageNumber: number;
  allGroups: Group[];
}

/**
 * מסך ההמתנה בשער סנכרון - קבוצה שהגיעה לשלב משותף לפני האחרות.
 *
 * ----------------------------------------------------------------------------
 * העיקרון: המתנה שלא מרגישה כמו תקלה
 * ----------------------------------------------------------------------------
 * זה המסך היחיד בסדנה שבו לקבוצה אין מה לעשות, ולכן הוא המסך שהכי מסוכן
 * שייראה כאילו משהו נתקע. שלושה דברים מונעים את זה:
 *   1. **מד התקדמות מפורש** - "2 מתוך 3 קבוצות כאן" נאמר גם במספר וגם
 *      בגלולה שמתמלאת, כך שרואים תנועה גם כשאין מה ללחוץ.
 *   2. **כרטיס לכל קבוצה** - מי כבר הגיעה ומי עוד לא, בשמות. ההמתנה
 *      הופכת ממצב מערכת למשהו חברתי שקורה בחדר.
 *   3. **נשימה** - הכרטיס של הקבוצה שממתינים לה פועם קלות, כדי שיהיה
 *      ברור שהמערכת חיה ולא קפאה.
 */
function WaitingScreen({ stageNumber, allGroups }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const arrivedCount = sorted.filter((g) => g.current_stage >= stageNumber).length;
  const percent = sorted.length > 0 ? Math.round((arrivedCount / sorted.length) * 100) : 0;

  return (
    <StageShell
      stage={stageNumber}
      kicker="שלב משותף"
      icon="users"
      title="ממתינות לשאר הקבוצות"
      subtitle="השלב הזה מתחיל כשכל הקבוצות מגיעות אליו. אפשר לנצל את הרגע לנשום."
      background="ripple"
      width="normal"
    >
      {/* מד ההגעה - כמה קבוצות כבר כאן */}
      <div className="glass glass-brick mb-8 flex w-full max-w-md flex-col gap-3 rounded-xl p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-2 text-sm font-bold">קבוצות שהגיעו</span>
          <span className="text-accent text-2xl font-extrabold tabular-nums">
            {arrivedCount}
            <span className="text-ink-3 text-base"> / {sorted.length}</span>
          </span>
        </div>
        <div
          className="glass-slider glass-slider--x h-3"
          role="progressbar"
          aria-valuenow={arrivedCount}
          aria-valuemin={0}
          aria-valuemax={sorted.length}
          style={{ ["--fill" as string]: percent }}
        >
          <span className="glass-slider__fill" />
        </div>
      </div>

      <ul className="flex w-full flex-wrap justify-center gap-4">
        {sorted.map((g, i) => {
          const arrived = g.current_stage >= stageNumber;
          return (
            <li
              key={g.id}
              className={cx(
                "glass glass-brick flex w-56 flex-col items-center gap-3 rounded-xl p-5 text-center",
                arrived && "!bg-ok-fill",
              )}
              style={{
                animation: `glass-in var(--ds-dur-slow) ${140 + i * 110}ms var(--ds-ease) both`,
              }}
            >
              <span
                className={cx(
                  "flex h-16 w-16 items-center justify-center",
                  arrived ? "bubble" : "bubble bubble-hollow text-ink-3",
                )}
                style={
                  arrived
                    ? undefined
                    : { animation: "soft-pulse 2.2s ease-in-out infinite" }
                }
              >
                <Icon name={arrived ? "check" : "hourglass"} size={26} />
              </span>

              <span className="text-ink text-lg font-extrabold">
                {g.name ?? `מסך ${g.screen_number}`}
              </span>

              <span
                className={cx("text-xs font-bold", arrived ? "text-ok" : "text-ink-3")}
              >
                {arrived ? "מוכנה" : "עדיין בשלב קודם"}
              </span>
            </li>
          );
        })}
      </ul>
    </StageShell>
  );
}

export default WaitingScreen;
