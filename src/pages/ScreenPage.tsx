import { useParams } from "react-router-dom";
import { useScreenData } from "../hooks/useScreenData";

function ScreenPage() {
  const { screenNumber: screenNumberParam } = useParams<{
    screenNumber: string;
  }>();
  const screenNumber = Number(screenNumberParam);
  const { loading, myGroup, allGroups } = useScreenData(screenNumber);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
      </main>
    );
  }

  if (!myGroup) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-xl">
          אין הפעלה פעילה כרגע, או שלא נמצאה קבוצה למסך {screenNumber}.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">מסך {screenNumber}</h1>
      <p className="text-lg">
        הקבוצה שלי: {myGroup.name ?? "(עדיין בלי שם)"} - שלב נוכחי:{" "}
        {myGroup.current_stage}
      </p>

      <div className="rounded-lg bg-white/10 px-6 py-4">
        <h2 className="mb-2 font-bold">מצב כל הקבוצות (מד התקדמות זמני):</h2>
        <ul className="flex flex-col gap-1">
          {allGroups
            .slice()
            .sort((a, b) => a.screen_number - b.screen_number)
            .map((g) => (
              <li key={g.id}>
                מסך {g.screen_number} - {g.name ?? "(בלי שם)"} - שלב{" "}
                {g.current_stage}
              </li>
            ))}
        </ul>
      </div>
    </main>
  );
}

export default ScreenPage;
