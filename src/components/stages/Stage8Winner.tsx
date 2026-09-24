import { useEffect, useMemo } from "react";
import { normalizeVotes, useRatings } from "../../hooks/useRatings";
import type { Group } from "../../types/group";

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

function playWinSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {
    // בלי צליל אם הדפדפן לא תומך - לא עוצרים את הזרימה.
  }
}

function Stage8Winner({ workshopId, myGroup, allGroups, onAdvance }: Props) {
  const { rows } = useRatings(workshopId, myGroup.id);

  // הדירוג בשלב 7 הוא "לייק": כל בת מסמנת כוכב אחד לכל סרטון שאהבה, ולכן
  // המנצחת היא מי שצברה הכי הרבה לייקים - לא ממוצע (כל הלייקים שווים 1).
  // normalizeVotes מטפלת גם בהפעלות ישנות שבהן נשמר דירוג 1-5 בודד.
  const winner = useMemo(() => {
    const likes: Record<string, number> = {};
    for (const row of rows) {
      for (const [groupId, votes] of Object.entries(normalizeVotes(row.data))) {
        likes[groupId] = (likes[groupId] ?? 0) + votes.length;
      }
    }
    let best: { group: Group; likes: number } | null = null;
    for (const g of allGroups) {
      const count = likes[g.id] ?? 0;
      if (!best || count > best.likes) best = { group: g, likes: count };
    }
    return best;
  }, [rows, allGroups]);

  useEffect(() => {
    if (winner) playWinSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!winner]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-8xl">🏆</div>
      <h1 className="text-4xl font-bold">
        {winner ? `הקבוצה המנצחת: ${winner.group.name ?? "?"}` : "מחשבת תוצאות..."}
      </h1>
      {winner && (
        <p className="text-white/70">
          {winner.likes} ★ {winner.likes === 1 ? "לייק" : "לייקים"}
        </p>
      )}
      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

export default Stage8Winner;
