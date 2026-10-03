import type { Group } from "../types/group";
import { cx } from "../lib/cx";
import Icon from "./ui/Icon";

interface Props {
  allGroups: Group[];
  myScreenNumber: number;
  /** מספר השלבים בתוכנית - כדי להציג "שלב 2 מתוך 10" ולא רק "שלב 2". */
  totalStages: number;
}

/**
 * מד התקדמות קבוצתי - מציג איפה נמצאת כל קבוצה, צד שמאל למטה (סעיף 5 ב-CLAUDE.md).
 *
 * ----------------------------------------------------------------------------
 * העיצוב: שלוש גלולות זכוכית שמתמלאות
 * ----------------------------------------------------------------------------
 * הגרסה הקודמת הייתה שלוש שורות טקסט ("קבוצה א - שלב 3 מתוך 10"), שדרשו
 * קריאה והשוואה בראש. כאן כל קבוצה היא גלולה שמתמלאת טורקיז לפי ההתקדמות,
 * ולכן "מי מקדימה" נקרא במבט אחד - וזה בדיוק מה שהמד הזה נועד לענות עליו.
 *
 * הקבוצה של המסך הנוכחי מסומנת בנקודה זוהרת ובטקסט מודגש, כדי שקבוצה לא
 * תתבלבל ותקרא את השורה של השכנה.
 */
function ProgressBar({ allGroups, myScreenNumber, totalStages }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);

  return (
    <aside
      aria-label="התקדמות הקבוצות"
      // על מסך צר המד מתכווץ לגרסה מינימלית (מספר מסך + פס בלבד): בפריסה
      // המלאה הוא תפס כרבע ממסך טלפון וכיסה את התוכן שמתחתיו.
      className="glass glass-brick fixed bottom-4 left-4 z-30 flex w-[9.5rem] flex-col gap-2.5 rounded-xl p-3 sm:bottom-6 sm:left-6 sm:w-[17rem] sm:p-4"
    >
      <div className="text-ink-3 hidden items-center gap-2 text-[11px] font-bold tracking-wide sm:flex">
        <Icon name="users" size={14} />
        התקדמות בחדר
      </div>

      {sorted.map((g) => {
        const isMine = g.screen_number === myScreenNumber;
        // קבוצה שעברה את השלב האחרון (הטיימר ממשיך לקדם גם אחרי הסוף)
        // הציגה "11/10", שנראה כמו באג. התצוגה נעצרת על מספר השלבים.
        const shownStage = Math.min(g.current_stage, totalStages);
        const percent =
          totalStages > 0 ? Math.min(100, Math.round((shownStage / totalStages) * 100)) : 0;

        return (
          <div key={g.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cx(
                  "flex min-w-0 items-center gap-1.5 truncate text-sm",
                  isMine ? "text-ink font-extrabold" : "text-ink-2 font-semibold",
                )}
              >
                {isMine && (
                  <span
                    aria-hidden="true"
                    className="bg-accent h-1.5 w-1.5 flex-none rounded-full"
                    style={{ boxShadow: "0 0 8px 1px var(--ds-glow)" }}
                  />
                )}
                <span className="hidden truncate sm:inline">
                  {g.name ?? `מסך ${g.screen_number}`}
                </span>
                <span className="sm:hidden">{g.screen_number}</span>
                {isMine && (
                  <span className="text-ink-3 hidden flex-none text-[10px] sm:inline">(אתן)</span>
                )}
              </span>
              <span className="text-ink-3 flex-none text-[11px] font-bold tabular-nums">
                {shownStage}/{totalStages}
              </span>
            </div>

            <div
              className={cx("glass-slider glass-slider--x h-2.5", !isMine && "opacity-70")}
              role="progressbar"
              aria-valuenow={shownStage}
              aria-valuemin={0}
              aria-valuemax={totalStages}
              aria-label={`${g.name ?? `מסך ${g.screen_number}`}: שלב ${shownStage} מתוך ${totalStages}`}
              style={{ ["--fill" as string]: percent }}
            >
              <span className="glass-slider__fill" />
            </div>
          </div>
        );
      })}
    </aside>
  );
}

export default ProgressBar;
