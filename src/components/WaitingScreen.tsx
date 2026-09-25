import type { Group } from "../types/group";

interface Props {
  stageNumber: number;
  allGroups: Group[];
}

/**
 * מסך ההמתנה בשער סנכרון - קבוצה שהגיעה לשלב משותף לפני האחרות. מעוצב
 * באותה שפה של שאר המסכים (רקע מדורג, כתמי אור, צ'יפ שלב), כדי שלא ייראה
 * כמו הודעת מערכת אלא כמו חלק מהסדנה.
 */
function WaitingScreen({ stageNumber, allGroups }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const arrivedCount = sorted.filter((g) => g.current_stage >= stageNumber).length;

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-8 py-10 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 12%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 60%, var(--color-smoke-blue-darker) 100%)",
      }}
    >
      <div className="pointer-events-none absolute top-[-12%] left-[-6%] h-[28rem] w-[28rem] rounded-full bg-[#5bc0eb]/10 blur-[130px]" />
      <div className="pointer-events-none absolute right-[-8%] bottom-[-14%] h-[30rem] w-[30rem] rounded-full bg-[#f5a25d]/8 blur-[140px]" />

      <div className="relative flex flex-col items-center gap-3" style={{ animation: "fade-up 0.7s ease-out both" }}>
        <span className="rounded-full border border-[#5bc0eb]/40 px-5 py-1.5 text-xs font-bold tracking-widest text-[#5bc0eb] uppercase">
          שלב {stageNumber} · שלב משותף
        </span>
        <h1 className="text-4xl font-black tracking-tight">ממתינים לשאר הקבוצות</h1>
        <p className="text-sm text-white/45">
          {arrivedCount} מתוך {sorted.length} קבוצות הגיעו. השלב יתחיל כשכולן כאן.
        </p>
      </div>

      <div className="relative flex flex-wrap justify-center gap-4">
        {sorted.map((g, i) => {
          const arrived = g.current_stage >= stageNumber;
          return (
            <div
              key={g.id}
              className={`flex w-56 flex-col items-center gap-2 rounded-2xl border px-5 py-4 transition-colors ${
                arrived
                  ? "border-[#6fcf7e]/40 bg-[#6fcf7e]/10"
                  : "border-white/10 bg-white/5"
              }`}
              style={{ animation: `fade-up 0.8s ${0.15 + i * 0.12}s ease-out both` }}
            >
              <span className="text-3xl">{arrived ? "✅" : "⏳"}</span>
              <span className="text-lg font-bold">{g.name ?? `מסך ${g.screen_number}`}</span>
              <span className={`text-xs font-bold ${arrived ? "text-[#6fcf7e]" : "text-white/40"}`}>
                {arrived ? "מוכנה" : "עדיין בשלב קודם"}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default WaitingScreen;
