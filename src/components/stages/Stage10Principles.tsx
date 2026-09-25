import type { Group } from "../../types/group";
import { useClosingPrinciple } from "../../hooks/useClosingPrinciple";

interface Props {
  workshopId: string;
  myGroup: Group;
}

/**
 * שלב 10 - משפט הסיום של הסדנה (שקף 15 במצגת: "מתוך כל הידע שנצבר ע"י AI
 * בסדנא"). ה-AI מנסח **משפט אחד** מתוך כל מה שהקבוצות יצרו לאורך הסדנה,
 * והוא מוצג זהה בשלושת המסכים - זה הרגע האחרון של האירוע.
 *
 * הניסוח עצמו נעשה ב-Edge Function (supabase/functions/generate-closing-principle)
 * ונשמר במסד, ולכן הוא נוצר פעם אחת ולא משתנה בין המסכים או ברענון.
 */
function Stage10Principles({ workshopId, myGroup }: Props) {
  const { sentence, loading, error } = useClosingPrinciple(workshopId, myGroup.id);

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-10 py-12 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 10%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 58%, var(--color-smoke-blue-darker) 100%)",
      }}
    >
      {/* כתמי אור רכים - אותו קו עיצוב, אבל שקט יותר: זה רגע של סיכום ולא חגיגה */}
      <div className="pointer-events-none absolute top-[-14%] left-[-8%] h-[32rem] w-[32rem] rounded-full bg-[#5bc0eb]/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-16%] h-[34rem] w-[34rem] rounded-full bg-[#f5a25d]/8 blur-[150px]" />

      <div className="relative flex flex-col items-center gap-3" style={{ animation: "fade-up 0.8s ease-out both" }}>
        <span className="rounded-full border border-[#5bc0eb]/40 px-5 py-1.5 text-xs font-bold tracking-widest text-[#5bc0eb] uppercase">
          שלב 10 · סיום התהליך
        </span>
        <h1 className="text-3xl font-bold text-white/85">העיקרון שעולה מהסדנה שלכן</h1>
      </div>

      {loading && (
        <div className="relative flex flex-col items-center gap-4">
          <div className="border-t-[#5bc0eb] h-12 w-12 animate-spin rounded-full border-4 border-white/15" />
          <p className="text-lg text-white/50">מנסחת את משפט הסיום מתוך כל מה שיצרתן...</p>
        </div>
      )}

      {!loading && error && (
        <div className="relative flex max-w-xl flex-col items-center gap-2 rounded-2xl border border-[#f5a25d]/40 bg-[#f5a25d]/10 px-8 py-5">
          <p className="font-bold text-[#f5a25d]">לא הצלחנו לנסח את משפט הסיום</p>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      )}

      {!loading && sentence && (
        <div
          className="relative flex max-w-5xl flex-col items-center gap-8"
          style={{ animation: "fade-up 1.4s 0.2s ease-out both" }}
        >
          <p className="text-4xl leading-[1.6] font-bold text-white">{sentence}</p>

          <span className="h-px w-40 bg-gradient-to-l from-transparent via-white/30 to-transparent" />
        </div>
      )}

      {!loading && (
        <p
          className="relative text-base font-bold text-white/40"
          style={{ animation: "fade-up 1s 1.2s ease-out both" }}
        >
          סיום התהליך · כלל הנתונים נשמרים במערכת
        </p>
      )}
    </main>
  );
}

export default Stage10Principles;
