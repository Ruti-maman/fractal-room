import { useState } from "react";
import type { Group } from "../types/group";
import RoomLoop from "./RoomLoop";
import { ROOM_LOOPS } from "../lib/roomLoops";

/**
 * המסך הרביעי - /screen/4 (2026-11-19, בקשת המפתחת).
 *
 * פלזמה גדולה ומשותפת לכל החדר, לא קבוצה: אין לה שם, משתתפות, טיימר או
 * כפתור "הבא". היא מחוברת לסדנה הפעילה בזמן אמת (אותו useScreenData כמו
 * שלושת המסכים) ורואה את שלוש הקבוצות. אין לה שורה בטבלת groups ואין שינוי
 * במסד - היא רק קוראת.
 *
 * מה מוצג - לפי "שלב החדר": השלב של רוב הקבוצות (majorityStage).
 * לכל שלב יש תצוגה משלו, לפי האפיון של הלקוחה:
 *   שלב 1 - ברוכות הבאות + לוגו פרקטל + לוגו הסמינר (RoomWelcome).
 *   שאר השלבים - בינתיים: מצב שלוש הקבוצות (RoomStatus), עד שיוגדר מה מוצג בהם.
 *
 * טקסטים: ברירות מחדל כאן, ונדרסים מ-program_stages.content.room של אותו
 * שלב (title) - כמו בשאר השלבים, כדי שממשק העריכה יוכל להחליף אותם.
 */

/** לוגו הסמינר - קובץ שהלקוחה תשלח. עד אז המקום פשוט לא מוצג. */
const SEMINAR_LOGO = "/brand/seminar-logo.png";

interface RoomContent {
  title?: string;
}

interface Props {
  allGroups: Group[];
  /** מספרי השלבים הקיימים בתוכנית, לפי הסדר - לסימון ההתקדמות. */
  stageNumbers: number[];
  /** תוכן "room" של כל שלב (program_stages.content.room), לפי מספר שלב. */
  roomContent?: Record<number, RoomContent | undefined>;
}

/**
 * "שלב החדר" = השלב של הרוב (החלטת המפתחת 2026-11-19): השלב שהכי הרבה
 * קבוצות נמצאות בו. כשאין רוב (כל קבוצה בשלב אחר) - השלב האמצעי.
 */
export function majorityStage(stages: number[]): number {
  if (stages.length === 0) return 1;
  const counts = new Map<number, number>();
  for (const s of stages) counts.set(s, (counts.get(s) ?? 0) + 1);
  const best = Math.max(...counts.values());
  if (best > 1) {
    // שוויון בין שני "רובים" (למשל 2-2 בארבע קבוצות) - הנמוך מביניהם
    return Math.min(...[...counts].filter(([, c]) => c === best).map(([s]) => s));
  }
  const sorted = stages.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function RoomScreen({ allGroups, stageNumbers, roomContent }: Props) {
  const groups = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const roomStage = majorityStage(groups.map((g) => g.current_stage));
  const content = roomContent?.[roomStage];

  // תצוגה מקדימה בשרת הפיתוח: /screen/4?loop=5&slide=3 מציג לופ (ושקף) מסוים
  const params = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const previewLoop = params?.get("loop");
  if (previewLoop && ROOM_LOOPS[previewLoop]) {
    const loop = ROOM_LOOPS[previewLoop];
    const s = Math.max(0, Math.min(loop.slides.length - 1, Number(params?.get("slide") ?? 1) - 1 || 0));
    return <RoomLoop loop={loop} startAt={s} />;
  }

  if (roomStage <= 1) return <RoomWelcome title={content?.title} />;
  // לופ השלב (שלבים 2-6, 8, 9) - לפי האפיון. שלבים 7, 10: עוד לא הוגדרו
  const loop = ROOM_LOOPS[String(roomStage)];
  if (loop) return <RoomLoop loop={loop} />;
  return <RoomStatus groups={groups} stageNumbers={stageNumbers} />;
}

/* --- שלב 1: ברוכות הבאות + שני הלוגואים ------------------------------------ */
function RoomWelcome({ title }: { title?: string }) {
  const [seminarLogoOk, setSeminarLogoOk] = useState(true);
  const words = (title || "ברוכות הבאות").split(/\s+/).filter(Boolean);

  return (
    <main className="opening-editorial rs-page rs-welcome" dir="rtl">
      <div className="ed-grid" aria-hidden="true" />
      <div className="ed-hline ed-hline--top" aria-hidden="true" />
      <div className="ed-hline ed-hline--bottom" aria-hidden="true" />

      <div className="rs-welcome__body">
        <h1 className="rs-welcome__title">
          {words.map((w, i) => (
            <span key={i} className="rs-welcome__word" style={{ animationDelay: `${0.3 + i * 0.25}s` }}>
              {w}
            </span>
          ))}
        </h1>

        {/* שני הלוגואים זה לצד זה, מופרדים בקו דק */}
        <div className="rs-logos">
          <img src="/brand/fractal-logo-on-light.png" alt="פרקטל - עומק. מימד. חדשנות." className="rs-logo" />
          {seminarLogoOk && (
            <>
              <span className="rs-logos__sep" aria-hidden="true" />
              <img
                src={SEMINAR_LOGO}
                alt="הסמינר להוראה ויזניץ"
                className="rs-logo"
                onError={() => setSeminarLogoOk(false)}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* --- בינתיים, לשאר השלבים: מצב שלוש הקבוצות --------------------------------- */
function RoomStatus({ groups, stageNumbers }: { groups: Group[]; stageNumbers: number[] }) {
  return (
    <main className="opening-editorial rs-page" dir="rtl">
      <div className="ed-grid" aria-hidden="true" />
      <div className="ed-hline ed-hline--top" aria-hidden="true" />
      <div className="ed-hline ed-hline--bottom" aria-hidden="true" />

      <aside className="ed-panel">
        <div className="ed-panel__body">
          <img src="/brand/fractal-logo-on-dark.png" alt="פרקטל - עומק. מימד. חדשנות." className="ed-panel__logo" />
        </div>
      </aside>

      <section className="rs-groups" aria-live="polite">
        {groups.map((g, i) => (
          <article key={g.id} className="rs-group" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
            <span className="rs-group__screen">מסך {g.screen_number}</span>
            <h2 className="rs-group__name">{g.name ?? `מסך ${g.screen_number}`}</h2>
            <span className="rs-group__stage" aria-label={`שלב ${g.current_stage}`}>
              {String(g.current_stage).padStart(2, "0")}
            </span>
            <ol className="rs-track" aria-hidden="true">
              {stageNumbers.map((n) => (
                <li
                  key={n}
                  className={n < g.current_stage ? "is-done" : n === g.current_stage ? "is-current" : undefined}
                />
              ))}
            </ol>
          </article>
        ))}
      </section>
    </main>
  );
}

export default RoomScreen;
