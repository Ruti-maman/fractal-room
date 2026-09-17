import type { Group } from "../types/group";

interface Props {
  stageNumber: number;
  allGroups: Group[];
}

function WaitingScreen({ stageNumber, allGroups }: Props) {
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">ממתינים לשאר הקבוצות...</h1>
      <div className="flex flex-col gap-2">
        {sorted.map((g) => {
          const arrived = g.current_stage >= stageNumber;
          return (
            <div
              key={g.id}
              className={`rounded-lg px-4 py-2 ${arrived ? "bg-wood/40" : "bg-white/10"}`}
            >
              {arrived ? "✅" : "⏳"} {g.name ?? `מסך ${g.screen_number}`}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default WaitingScreen;
