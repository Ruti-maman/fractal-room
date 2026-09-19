import type { Stage6Content } from "../../types/stage6Content";

interface Props {
  content: Stage6Content;
  onAdvance: () => void;
}

/**
 * שלב 6 - דיון קבוצתי מונחה (שקף 10 במצגת). שלב עצמאי, פשוט: משפט השראה
 * וטיימר (בצורת שעון חול, לפי המצגת) - הדיון עצמו מתנהל בעל-פה בחדר, לא במסך.
 */
function Stage6Discussion({ content, onAdvance }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="text-7xl">⏳</div>
      <h1 className="text-2xl font-bold">זמן דיון קבוצתי מונחה</h1>
      <p className="max-w-lg text-xl italic text-white/80">"{content.quote}"</p>
      <p className="text-sm text-white/50">
        הדיון מהווה את הבסיס המקדים לשלב הסימולציות הבא.
      </p>
      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold transition-transform duration-100 active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

export default Stage6Discussion;
