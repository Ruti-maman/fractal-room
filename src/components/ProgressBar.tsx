import type { Group } from "../types/group";

interface Props {
  allGroups: Group[];
  myScreenNumber: number;
}

/** מד התקדמות קבוצתי - מציג איפה נמצאת כל קבוצה, צד שמאל למטה (סעיף 5 ב-CLAUDE.md). */
function ProgressBar({ allGroups, myScreenNumber }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);

  return (
    <div className="fixed bottom-6 left-6 flex flex-col gap-1 rounded-xl bg-white/10 px-4 py-3 text-sm">
      {sorted.map((g) => (
        <div
          key={g.id}
          className={g.screen_number === myScreenNumber ? "font-bold" : "text-white/70"}
        >
          {g.name ?? `מסך ${g.screen_number}`} - שלב {g.current_stage}
        </div>
      ))}
    </div>
  );
}

export default ProgressBar;
