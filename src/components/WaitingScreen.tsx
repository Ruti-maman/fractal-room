import { useEffect, useState } from "react";
import type { Group } from "../types/group";
import { cx } from "../lib/cx";
import { useMedia } from "../hooks/useMedia";
import { listProjectClips } from "../lib/projectClips";
import StageShell from "./StageShell";
import { GroupClip } from "./stages/Stage7Simulation";
import Icon from "./ui/Icon";

interface Props {
  stageNumber: number;
  allGroups: Group[];
  /** נדרש להצגת ההסרטות במסך ההמתנה לשלב 8. */
  workshopId?: string;
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
/*
  שלב 8 (המנצחת) מגיע מיד אחרי ההקלטות של שלב 7. לבקשת הלקוחה, בזמן
  ההמתנה כל חלונית מציגה את ההסרטה של הקבוצה עם השם שלה ו-V גדול - במקום
  כרטיס עם אייקון קטן. ההקלטות נשלפות רק כאן (רכיב נפרד), כדי שמסך
  ההמתנה של שאר השלבים לא ישאל את השרת על מדיה בכל שנייה וחצי.
*/
/*
  גודל החלוניות: הרוחב הוא שליש מהרווח **שבין** מד ההתקדמות לטיימר שבפינות
  (39rem לשניהם יחד, עם מרווח), עד 26rem. כך החלוניות אף פעם לא עולות על
  הפאנלים, ויכולות לרדת עד תחתית המסך. הגובה - 3/4 מהרוחב (היחס של
  ההקלטה), ולא יותר ממה שנשאר בגובה מתחת לכותרת.
*/
const CLIP_TILE_W = "min(26rem, calc((100vw - 39rem - 2rem) / 3))";
const CLIP_TILE_H = `min(calc(${CLIP_TILE_W} * 3 / 4), calc(100dvh - 31rem))`;

/**
 * V גדול בלי עיגול סביבו (לבקשת הלקוחה): הקו עצמו צבוע בגרדיאנט הקשת של
 * הסדנה, ונמשך פנימה כאילו נכתב עכשיו (draw-stroke). אחריו הבזק אור שעובר
 * לאורכו, והילה צבעונית שנושמת לאט. קו כהה דק מתחת לקו הצבעוני שומר שה-V
 * ייקרא גם על פריים בהיר של הסרטון.
 */
function BigCheck({ id }: { id: string }) {
  const gid = `check-grad-${id}`;
  // אורך הנתיב בערך - draw-stroke מצייר מ-0 עד אורך מלא
  const len = 135;
  return (
    <svg
      viewBox="0 0 120 100"
      className="h-24 w-28"
      aria-hidden="true"
      style={{ animation: "check-glow 2.4s 1s ease-in-out infinite", overflow: "visible" }}
    >
      <defs>
        {/* stopColor דרך style ולא כתכונה - כך הוא מקבל את משתני הקשת */}
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" style={{ stopColor: "var(--ds-rainbow-1)" }} />
          <stop offset="35%" style={{ stopColor: "var(--ds-rainbow-2)" }} />
          <stop offset="65%" style={{ stopColor: "var(--ds-rainbow-3)" }} />
          <stop offset="100%" style={{ stopColor: "var(--ds-rainbow-4)" }} />
        </linearGradient>
      </defs>
      {/* צל כהה דק - קריאוּת על כל רקע */}
      <path
        d="M14 54 L44 82 L106 16"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={17}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ ["--dash" as string]: len, strokeDasharray: len, animation: "draw-stroke 0.7s 0.15s var(--ds-ease) both" }}
      />
      {/* ה-V הצבעוני */}
      <path
        d="M14 54 L44 82 L106 16"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ ["--dash" as string]: len, strokeDasharray: len, animation: "draw-stroke 0.7s 0.15s var(--ds-ease) both" }}
      />
      {/* הבזק אור שרץ לאורך הקו אחרי שהוא נכתב */}
      <path
        d="M14 54 L44 82 L106 16"
        fill="none"
        stroke="white"
        strokeOpacity={0.85}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: `18 ${len}`, animation: "check-shine 2.4s 0.9s ease-in-out infinite" }}
      />
    </svg>
  );
}

function ClipTiles({
  workshopId,
  stageNumber,
  groups,
}: {
  workshopId: string;
  stageNumber: number;
  groups: Group[];
}) {
  const { items: media } = useMedia(workshopId, 7);
  const [projectClips, setProjectClips] = useState<string[]>([]);
  // אילו סרטונים מתנגנים עכשיו - ה-V שבמרכז נעלם בזמן ניגון, כדי לא לכסות את הדוברת
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  useEffect(() => {
    listProjectClips(workshopId).then(setProjectClips);
  }, [workshopId]);

  return (
    <ul className="flex w-full flex-wrap justify-center gap-4">
      {groups.map((g, i) => {
        const arrived = g.current_stage >= stageNumber;
        // ההקלטה האחרונה של הקבוצה (אם הקליטה כמה פעמים)
        const clip = media
          .filter((m) => m.group_id === g.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return (
          <li
            key={g.id}
            className="glass glass-brick glass-raised flex flex-col overflow-hidden rounded-2xl text-center"
            style={{
              width: CLIP_TILE_W,
              animation: `glass-in var(--ds-dur-slow) ${140 + i * 110}ms var(--ds-ease) both`,
            }}
          >
            <div className="relative">
              {clip ? (
                <GroupClip
                  workshopId={workshopId}
                  groupId={g.id}
                  url={clip.url}
                  title={g.name ?? `מסך ${g.screen_number}`}
                  inProject={projectClips.includes(g.id)}
                  height={CLIP_TILE_H}
                  onPlayingChange={(p) => setPlaying((prev) => ({ ...prev, [g.id]: p }))}
                />
              ) : (
                <div
                  className="glass-dim text-ink-3 flex w-full flex-col items-center justify-center gap-2"
                  style={{ height: CLIP_TILE_H }}
                >
                  <Icon name="hourglass" size={26} />
                  <span className="text-xs font-bold">אין עדיין הסרטה</span>
                </div>
              )}

              {/*
                V גדול במרכז הסרטון - הקבוצה כאן ומוכנה (דרישת הלקוחה). קופץ
                פנימה עם טבעת אור שמתפשטת, ונושם לאט. pointer-events-none: לא
                חוסם את הנגן; ובזמן ניגון הוא נעלם כדי לא לכסות את הדוברת.
                מעל הפקדים של הנגן (bottom-12), כדי שגם הם לא יוסתרו.
              */}
              {arrived && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 bottom-12 flex items-center justify-center transition-opacity duration-300"
                  style={{ opacity: playing[g.id] ? 0 : 1 }}
                >
                  <BigCheck id={g.id} />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-0.5 px-4 py-2">
              <span className="text-ink text-xl font-extrabold">{g.name ?? `מסך ${g.screen_number}`}</span>
              <span className={cx("text-xs font-bold", arrived ? "text-ok" : "text-ink-3")}>
                {arrived ? "מוכנה" : "עדיין בשלב קודם"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WaitingScreen({ stageNumber, allGroups, workshopId }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const arrivedCount = sorted.filter((g) => g.current_stage >= stageNumber).length;
  const percent = sorted.length > 0 ? Math.round((arrivedCount / sorted.length) * 100) : 0;
  const showClips = stageNumber === 8 && Boolean(workshopId);

  return (
    <StageShell
      stage={stageNumber}
      kicker="שלב משותף"
      icon="users"
      // "צוותים" ולא "קבוצות" - הנחיית הלקוחה במצגת: "באופן כללי במקום
      // קבוצות צוותי עבודה" (טקסטי המערכת; התסריט עצמו נשאר כפי שנכתב)
      title="ממתינים לשאר הצוותים"
      subtitle="השלב הזה מתחיל כשכל הצוותים מגיעים אליו. אפשר לנצל את הרגע לנשום."
      background="ripple"
      // עם ההסרטות: רוחב מלא (החלוניות עצמן מוגבלות לרווח שבין הפינות),
      // ובלי הרצועה התחתונה - החלוניות בין הפאנלים, לא מתחתם
      width={showClips ? "full" : "normal"}
      tightBottom={showClips}
      compactHeader={showClips}
    >
      {/* מד ההגעה - כמה קבוצות כבר כאן */}
      <div
        className={cx(
          "glass glass-brick glass-raised flex w-full max-w-md flex-col gap-3 rounded-xl",
          showClips ? "mb-4 p-3.5" : "mb-8 p-5",
        )}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-ink-2 text-sm font-bold">צוותים שהגיעו</span>
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

      {showClips ? (
        <ClipTiles workshopId={workshopId!} stageNumber={stageNumber} groups={sorted} />
      ) : (
      <ul className="flex w-full flex-wrap justify-center gap-4">
        {sorted.map((g, i) => {
          const arrived = g.current_stage >= stageNumber;
          return (
            <li
              key={g.id}
              className={cx(
                "glass glass-brick glass-raised flex w-56 flex-col items-center gap-3 rounded-xl p-5 text-center",
                arrived && "!bg-ok-fill",
              )}
              style={{
                animation: `glass-in var(--ds-dur-slow) ${140 + i * 110}ms var(--ds-ease) both`,
              }}
            >
              <span
                className={cx(
                  "flex h-16 w-16 items-center justify-center",
                  arrived
                    ? `bubble bubble--${((g.screen_number - 1) % 5) + 1}`
                    : "bubble bubble-hollow text-ink-3",
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
      )}
    </StageShell>
  );
}

export default WaitingScreen;
