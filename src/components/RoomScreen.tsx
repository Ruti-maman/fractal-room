import { useEffect, useState } from "react";
import type { Group } from "../types/group";
import RoomLoop from "./RoomLoop";
import TipBubbles from "./TipBubbles";
import FractalFullscreen from "./FractalFullscreen";
import { useParticipants } from "../hooks/useParticipants";
import { supabase } from "../lib/supabase";
import TipChat from "./TipChat";
import RoomRecordings from "./RoomRecordings";
import RoomPrinciple from "./RoomPrinciple";
import type { Tip } from "./TipPopups";
import { DEFAULT_TIPS } from "../lib/stage6Texts";
import LoopGallery, { type GalleryItem } from "./LoopGallery";

/** מה שהמסך הגדול צריך מתוכן שלב 6 */
interface Stage6Content {
  tips_title?: string;
  tips?: Tip[];
  fractal_title?: string;
  fractal_text?: string;
}
import { ROOM_LOOPS, majorityStage } from "../lib/roomLoops";
import {
  IDENTIFICATION_DEFAULTS,
  ROOM_DEFAULTS,
  type IdentificationTexts,
  type RoomTexts,
} from "../lib/identificationTexts";

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

interface Stage2Content {
  identification?: Partial<IdentificationTexts> | Record<string, unknown>;
  room?: Partial<RoomTexts> | Record<string, unknown>;
}

interface Props {
  allGroups: Group[];
  /** מספרי השלבים הקיימים בתוכנית, לפי הסדר - לסימון ההתקדמות. */
  stageNumbers: number[];
  /** תוכן "room" של כל שלב (program_stages.content.room), לפי מספר שלב. */
  roomContent?: Record<number, RoomContent | undefined>;
  /** תוכן שלב 2 - לטיפים, ל"כלל הפרקטל" ול"מי בחדר" במסך הגדול. */
  stage2Content?: Stage2Content;
  /** תוכן שלב 6 - "כלל הפרקטל" של הדיון ("תשובה טובה לא סוגרת את הדיון"). */
  stage6Content?: Stage6Content;
}

/*
 * התאמה לגודל המסך (2026-11-23). המסך הגדול בחדר: כ-196×116 ס"מ (בערך 90
 * אינץ', כמעט בוודאות 4K - 3840×2160). העיצוב נבנה ונבדק על 1920×1080, וחלק
 * מהטקסטים מוגבלים בגודל מרבי ב-rem - ולכן ב-4K הכול יצא בחצי גודל.
 * הפתרון: גודל הגופן הבסיסי (rem) גדל ביחס בין המסך ל-1920×1080. מה שנמדד
 * ב-vw/vh ממילא גדל עם המסך, ועכשיו גם מה שנמדד ב-rem - כך שב-4K הכול נראה
 * בדיוק כמו ב-1920, רק חד פי שניים. (zoom לא מתאים כאן: הוא מכפיל גם את
 * vw/vh, שכבר גדלו עם המסך, והם יצאו כפולים.)
 * המינימום בין רוחב לגובה - כדי שמסך ביחס אחר לא יחתוך כלום.
 */
const DESIGN_W = 1920;
const DESIGN_H = 1080;

function useFitToScreen() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const fit = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      root.style.fontSize = `${16 * fit}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.fontSize = "";
    };
  }, []);
}

function RoomScreen({ allGroups, stageNumbers, roomContent, stage2Content, stage6Content }: Props) {
  useFitToScreen();
  const groups = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const roomStage = majorityStage(groups.map((g) => g.current_stage));
  const content = roomContent?.[roomStage];

  // תצוגה מקדימה: /screen/4?loop=5&slide=3 מציג לופ (ושקף) מסוים. פתוח גם באתר
  // שבענן (2026-11-20, בקשת המפתחת) - כדי שהלקוחה תוכל לעבור על כל הלופים בלי
  // להריץ סדנה. רק מציג, לא כותב כלום. בלי ?loop= - לפי שלב הקבוצות, כרגיל.
  const params = new URLSearchParams(location.search);
  const previewLoop = params?.get("loop");
  // /screen/4?loop=all - הדגמה: כל הלופים בזה אחר זה, בלי סדנה
  if (previewLoop === "all") return <AllLoopsDemo />;
  // /screen/4?loop=gallery - ברוכות הבאות, ואז כל הלופים כריבועים לבחירה (בקשת הלקוחה)
  if (previewLoop === "gallery") {
    return (
      <LoopGallery
        items={GALLERY_ITEMS}
        welcome={<RoomWelcome title={content?.title} />}
        renderItem={(key, step) => (
          <GalleryScreen itemKey={key} step={step} groups={groups} stage2Content={stage2Content} stage6Content={stage6Content} />
        )}
      />
    );
  }
  if (previewLoop === "1") return <RoomWelcome title={content?.title} />;
  // /screen/4?loop=2&part=tips|fractal|room - חלק מסוים בסבב של שלב 2
  const previewPart = params?.get("part") as Stage2Part | null;
  if (previewLoop === "2" && previewPart && STAGE2_PARTS.includes(previewPart)) {
    return <Stage2Cycle groups={groups} content={stage2Content} startAt={previewPart} />;
  }
  // /screen/4?loop=10 - העיקרון של הסדנה (שלב 10)
  if (previewLoop === "10") return <RoomPrinciple workshopId={groups[0]?.workshop_id ?? ""} />;
  // /screen/4?loop=7 - ההקלטות של הקבוצות (שלב 7)
  if (previewLoop === "7") return <RoomRecordings groups={groups} />;
  // /screen/4?loop=6&part=fractal - "כלל הפרקטל" של שלב 6
  if (previewLoop === "6" && (previewPart === "fractal" || previewPart === ("tips" as Stage2Part))) {
    return <Stage6Cycle content={stage6Content} startAt={previewPart as Stage6Part} />;
  }
  // /screen/4?loop=4&part=cycle&slide=10 - הסבב של שלב 4 (שני הלופים לסירוגין)
  if (previewLoop === "4" && previewPart === ("cycle" as Stage2Part)) {
    return <Stage4Cycle startSlide={Math.max(0, Number(params?.get("slide") ?? 1) - 1)} />;
  }
  if (previewLoop && ROOM_LOOPS[previewLoop]) {
    const loop = ROOM_LOOPS[previewLoop];
    const s = Math.max(0, Math.min(loop.slides.length - 1, Number(params?.get("slide") ?? 1) - 1 || 0));
    return <RoomLoop loop={loop} startAt={s} />;
  }

  if (roomStage <= 1) return <RoomWelcome title={content?.title} />;
  if (roomStage === 2) return <Stage2Cycle groups={groups} content={stage2Content} />;
  if (roomStage === 4) return <Stage4Room groups={groups} />;
  if (roomStage === 7) return <RoomRecordings groups={groups} />;
  if (roomStage === 10) return <RoomPrinciple workshopId={groups[0]?.workshop_id ?? ""} />;
  if (roomStage === 6) return <Stage6Cycle content={stage6Content} />;
  // לופ השלב (שלבים 2-6, 8, 9) - לפי האפיון. שלבים 7, 10: עוד לא הוגדרו
  const loop = ROOM_LOOPS[String(roomStage)];
  if (loop) return <RoomLoop loop={loop} />;
  return <RoomStatus groups={groups} stageNumbers={stageNumbers} />;
}

/* --- שלב 2: סבב של ארבע תצוגות ---------------------------------------------
 * לפי האפיון של הלקוחה, בשלב 2 המסך הגדול מציג גם את מסך הטיפים ("את המסך
 * הזה על המסך הגדול"), את "כלל הפרקטל" ("את הכלל על המסך הגדול") ואת "מי
 * בחדר" ("הופעת שלושת הקבוצות"). המסך הגדול לא יודע באיזה מסך-משנה כל קבוצה
 * נמצאת (החלטת המפתחת 2026-11-19: בלי לשמור את זה במסד), ולכן הוא עובר
 * ביניהן בסבב קבוע: הלופ ← הטיפים ← כלל הפרקטל ← מי בחדר ← הלופ...
 */
type Stage2Part = "loop" | "tips" | "fractal" | "room";
const STAGE2_PARTS: Stage2Part[] = ["loop", "tips", "fractal", "room"];
/** כמה זמן כל תצוגה (הלופ והכלל קובעים את הזמן שלהם בעצמם) */
const TIPS_SECONDS = 28;
const ROOM_SECONDS = 20;

/*
 * 2026-11-20 - לפי המקום של הקבוצות, בלי שינוי במסד: כששם הקבוצה נשמר
 * (groups.name), הקבוצה סיימה את ההזדהות ועברה ל"כלל הפרקטל" ול"מי בחדר".
 *   רוב הקבוצות עוד מזדהות  -> הלופ "פרקטל וזה קהל" + חלון הטיפים (בזמן בחירת השם)
 *   רוב הקבוצות כבר הזדהו   -> "כלל הפרקטל" פעם אחת, ואז "מי בחדר" (מתעדכן חי)
 * startAt - רק לתצוגה המקדימה (?loop=2&part=...), שם הסבב רץ על כל החלקים.
 */
function Stage2Cycle({
  groups,
  content,
  startAt,
}: {
  groups: Group[];
  content?: Stage2Content;
  startAt?: Stage2Part;
}) {
  const inStage2 = groups.filter((g) => g.current_stage === 2);
  const named = inStage2.filter((g) => g.name).length;
  const identified = !startAt && inStage2.length > 0 && named * 2 > inStage2.length;
  const parts: Stage2Part[] = startAt ? STAGE2_PARTS : identified ? ["fractal", "room"] : ["loop", "tips"];

  const [part, setPart] = useState<Stage2Part>(startAt ?? parts[0]);
  // הקבוצות עברו מההזדהות ל"מי בחדר" - מתחילים את החלק החדש מההתחלה
  useEffect(() => {
    if (!startAt) setPart(parts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified]);

  const next = () =>
    setPart((p) => {
      // אחרי ההזדהות: "כלל הפרקטל" פעם אחת, ומשם "מי בחדר" נשאר
      if (identified && p === "room") return "room";
      return parts[(parts.indexOf(p) + 1) % parts.length];
    });
  const t = { ...IDENTIFICATION_DEFAULTS, ...(content?.identification ?? {}) } as IdentificationTexts;

  useEffect(() => {
    if (part !== "tips" && part !== "room") return;
    if (identified && part === "room") return;
    const id = window.setTimeout(next, (part === "tips" ? TIPS_SECONDS : ROOM_SECONDS) * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part, identified]);

  if (part === "loop") return <RoomLoop loop={ROOM_LOOPS["2"]} onComplete={next} />;
  if (part === "tips") {
    return (
      // רקע כחול מתחת לחלון הטיפים (הוא עצמו שכבה צפה)
      <main className="rl-page rl-page--riddle" dir="rtl">
        <TipBubbles open displayOnly onClose={next} title={t.tips_title} tips={t.tips} />
      </main>
    );
  }
  if (part === "fractal") {
    return <FractalFullscreen variant="editorial" title={t.fractal_title} text={t.fractal_text} onDone={next} />;
  }
  return <WhoIsInRoom groups={groups} content={content} />;
}

/* --- שלב 4: שני לופים לסירוגין ---------------------------------------------
 * לפי האפיון יש בשלב 4 שני לופים: "פרקטל במשקל" (בזמן סימון החוזקות והחסמים)
 * ו"פרקטל בפועל" (בזמן תמונת התפקוד והמסקנה המעשית). המסך הגדול לא יודע
 * באיזה מהם הקבוצות נמצאות (בלי שמירה במסד - החלטת המפתחת 2026-11-19),
 * ולכן הם מתחלפים: לופ שלם של אחד, ואז לופ שלם של השני.
 */
function Stage4Cycle({ startSlide = 0 }: { startSlide?: number }) {
  const [which, setWhich] = useState<"4" | "4b">("4");
  return (
    <RoomLoop
      key={which}
      loop={ROOM_LOOPS[which]}
      startAt={which === "4" ? startSlide : 0}
      onComplete={() => setWhich((w) => (w === "4" ? "4b" : "4"))}
    />
  );
}

/*
 * שלב 4 בחדר האמיתי (2026-11-20, בקשת המפתחת "אז אתה יכול לתקן?"):
 * "פרקטל במשקל" בזמן הסימון, ו"פרקטל בפועל" בזמן תמונת התפקוד והמסקנה.
 * בלי שינוי במסד: כשקבוצה נכנסת לתמונת התפקוד, ה-AI כבר כותב לה שורה
 * ב-responses (type "functioning_picture"). המסך הגדול שואל כל כמה שניות
 * כמה מהקבוצות שבשלב 4 כבר שם - ואם רובן, עובר ל"פרקטל בפועל".
 */
const PICTURE_POLL_MS = 3000;

function useGroupsAtPicture(workshopId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!workshopId) return;
    let alive = true;
    const load = () =>
      supabase
        .from("responses")
        .select("group_id")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 4)
        .eq("type", "functioning_picture")
        .then(({ data }) => {
          if (alive && data) setIds(new Set(data.map((r) => r.group_id as string)));
        });
    load();
    const t = window.setInterval(load, PICTURE_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [workshopId]);
  return ids;
}

function Stage4Room({ groups }: { groups: Group[] }) {
  const atPicture = useGroupsAtPicture(groups[0]?.workshop_id);
  const inStage4 = groups.filter((g) => g.current_stage === 4);
  const reached = inStage4.filter((g) => atPicture.has(g.id)).length;
  // רוב הקבוצות שבשלב 4 כבר בתמונת התפקוד
  const which: "4" | "4b" = inStage4.length > 0 && reached * 2 > inStage4.length ? "4b" : "4";
  return <RoomLoop key={which} loop={ROOM_LOOPS[which]} />;
}

/* --- שלב 6: הלופ + "כלל הפרקטל" על כל המסך --------------------------------
 * האפיון, סעיף 20: "מסך מסר - כלל הפרקטל (תשובה טובה לא סוגרת את הדיון):
 * כלל הפרקטל על כל המסך". מוצג אחרי כל סיבוב של "פרקטל במעגל", באותו
 * אפקט חלקיקים ובאותו טקסט שהקבוצות רואות (content של שלב 6).
 */
const STAGE6_FRACTAL_DEFAULTS = {
  tips_title: "טיפים לדיון טוב",
  fractal_title: "כלל הפרקטל",
  fractal_text: "תשובה טובה לא סוגרת את הדיון. היא פותחת עוד שכבה.",
};

/*
 * 2026-11-20 (בקשת המפתחת): גם חלון "טיפים לדיון טוב" של שלב 6 נכנס לסבב,
 * כמו הטיפים של שלב 2. הסבב: הלופ ← הטיפים ← כלל הפרקטל ← הלופ.
 */
type Stage6Part = "loop" | "tips" | "fractal";
const STAGE6_PARTS: Stage6Part[] = ["loop", "tips", "fractal"];
const STAGE6_TIPS_SECONDS = 22;

function Stage6Cycle({ content, startAt = "loop" }: { content?: Stage6Content; startAt?: Stage6Part }) {
  const [part, setPart] = useState<Stage6Part>(startAt);
  const next = () => setPart((p) => STAGE6_PARTS[(STAGE6_PARTS.indexOf(p) + 1) % STAGE6_PARTS.length]);
  const t = { ...STAGE6_FRACTAL_DEFAULTS, ...(content ?? {}) };
  const tips = content?.tips?.length ? content.tips : DEFAULT_TIPS;

  useEffect(() => {
    if (part !== "tips") return;
    const id = window.setTimeout(next, STAGE6_TIPS_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [part]);

  if (part === "tips") {
    return (
      // הצ'אט הוא חלון צף - מתחתיו רקע כחול מלא עם הרשת
      <main className="rl-page rl-page--riddle" dir="rtl">
        <div className="rl-grid" aria-hidden="true" />
        <TipChat open displayOnly onClose={next} title={t.tips_title} tips={tips} confirmLabel="" />
      </main>
    );
  }
  if (part === "fractal") {
    return <FractalFullscreen variant="editorial" title={t.fractal_title} text={t.fractal_text} onDone={next} />;
  }
  return <RoomLoop loop={ROOM_LOOPS["6"]} onComplete={next} />;
}

/** "מי בחדר" במסך הגדול - שלוש הקבוצות, כל אחת עם השם והמשתתפות, בזמן אמת. */
function WhoIsInRoom({ groups, content }: { groups: Group[]; content?: Stage2Content }) {
  const t = { ...ROOM_DEFAULTS, ...(content?.room ?? {}) } as RoomTexts;
  const participants = useParticipants(groups.map((g) => g.id));

  return (
    <main className="rl-page rl-page--riddle wr-page" dir="rtl">
      <div className="rl-grid" aria-hidden="true" />

      <header className="wr-head">
        <h1 className="wr-title">מי בחדר</h1>
        <p className="wr-intro">{t.intro}</p>
      </header>

      <h2 className="wr-journey">{t.journey_title}</h2>

      <ul className="wr-cards">
        {groups.map((g, i) => {
          const names = participants.filter((p) => p.group_id === g.id);
          return (
            <li
              key={g.id}
              className={`wr-card${g.name ? " is-in" : ""}`}
              style={{ animationDelay: `${0.3 + i * 0.2}s` }}
            >
              <span className="wr-card__badge" aria-hidden="true">
                {g.name ? "✓" : g.screen_number}
              </span>
              <p className="wr-card__row">
                <b>קבוצה:</b> <span className={g.name ? "" : "wr-empty"}>{g.name ?? "טרם הזדהו"}</span>
              </p>
              <div className="wr-card__row">
                <b>משתתפות:</b>
                {names.length > 0 && (
                  <ul className="wr-names">
                    {names.map((p) => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="wr-foot">
        <p>{t.after_line}</p>
        <p className="wr-foot__bold">{t.after_bold}</p>
      </footer>
    </main>
  );
}

/* --- הדגמה: כל הלופים ברצף (/screen/4?loop=all, 2026-11-20) -------------
 * למסירה ללקוחה: מסך הפתיחה, ואחריו כל לופ במלואו לפי סדר השלבים, וחוזר
 * להתחלה. רק להדגמה - בחדר עצמו /screen/4 עוקב אחרי שלב הקבוצות. */
const DEMO_ORDER = ["2", "3", "4", "4b", "5", "6", "8", "9"];
const DEMO_WELCOME_SECONDS = 10;

function AllLoopsDemo() {
  const [i, setI] = useState(-1); // -1 = מסך הפתיחה
  useEffect(() => {
    if (i !== -1) return;
    const t = window.setTimeout(() => setI(0), DEMO_WELCOME_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [i]);
  if (i === -1) return <RoomWelcome />;
  const key = DEMO_ORDER[i];
  return (
    <RoomLoop
      key={key}
      loop={ROOM_LOOPS[key]}
      onComplete={() => setI((n) => (n + 1 >= DEMO_ORDER.length ? -1 : n + 1))}
    />
  );
}

/* --- גלריית הלופים (/screen/4?loop=gallery, 2026-11-24) -------------------
 * כל מה שהמסך הגדול יודע להציג, כריבוע אחד לכל תצוגה, לפי סדר השלבים. */
/** שורת הפתיחה של לופ - הטקסט של השקף הראשון (בדרך כלל החידה) */
const opening = (key: string) => ROOM_LOOPS[key]?.slides[0]?.text ?? "";

const GALLERY_ITEMS: GalleryItem[] = [
  { key: "welcome", stage: 1, title: "ברוכות הבאות", kind: "welcome", teaser: "פרקטל. עומק, מימד, חדשנות." },
  { key: "2", stage: 2, title: ROOM_LOOPS["2"].title, kind: "loop", teaser: opening("2") },
  { key: "2-tips", stage: 2, title: "טיפים לשם הקבוצה", kind: "screen", teaser: IDENTIFICATION_DEFAULTS.tips_title },
  { key: "2-fractal", stage: 2, title: "כלל הפרקטל", kind: "screen", teaser: IDENTIFICATION_DEFAULTS.fractal_text },
  { key: "2-room", stage: 2, title: "מי בחדר", kind: "screen", teaser: ROOM_DEFAULTS.intro },
  { key: "3", stage: 3, title: ROOM_LOOPS["3"].title, kind: "loop", teaser: opening("3") },
  { key: "4", stage: 4, title: ROOM_LOOPS["4"].title, kind: "loop", teaser: opening("4") },
  { key: "4b", stage: 4, title: ROOM_LOOPS["4b"].title, kind: "loop", teaser: opening("4b") },
  { key: "5", stage: 5, title: ROOM_LOOPS["5"].title, kind: "loop", teaser: opening("5") },
  { key: "6", stage: 6, title: ROOM_LOOPS["6"].title, kind: "loop", teaser: opening("6") },
  { key: "6-tips", stage: 6, title: "טיפים לדיון טוב", kind: "screen", teaser: DEFAULT_TIPS[0]?.title },
  { key: "7", stage: 7, title: "ההקלטות של הקבוצות", kind: "screen", teaser: "ההקלטות של שלוש הקבוצות, בזו אחר זו." },
  { key: "8", stage: 8, title: ROOM_LOOPS["8"].title, kind: "loop", teaser: opening("8") },
  { key: "9", stage: 9, title: ROOM_LOOPS["9"].title, kind: "loop", teaser: opening("9") },
  { key: "10", stage: 10, title: "העיקרון של הסדנה", kind: "screen", teaser: "העיקרון שעולה מהסדנה שלכן." },
];

/** מה שמוצג בתוך החלון של ריבוע בגלריה. כל תצוגה חוזרת על עצמה בלי סוף. */
function GalleryScreen({
  itemKey,
  step,
  groups,
  stage2Content,
  stage6Content,
}: {
  itemKey: string;
  /** השקף בלופ - בגלריה הלופים עוברים רק בנגיעה (RoomLoop.manualIndex) */
  step: number;
  groups: Group[];
  stage2Content?: Stage2Content;
  stage6Content?: Stage6Content;
}) {
  const t2 = { ...IDENTIFICATION_DEFAULTS, ...(stage2Content?.identification ?? {}) } as IdentificationTexts;
  const t6 = { ...STAGE6_FRACTAL_DEFAULTS, ...(stage6Content ?? {}) };

  switch (itemKey) {
    case "welcome":
      return <RoomWelcome />;
    case "2-tips":
      return (
        <main className="rl-page rl-page--riddle" dir="rtl">
          <TipBubbles open displayOnly onClose={() => {}} title={t2.tips_title} tips={t2.tips} manualIndex={step} />
        </main>
      );
    case "2-fractal":
      // בגלריה - גרסה נקייה וקריאה (אפקט החול לא נקרא כשהחלון קטן)
      // נגיעה = הכלל נכתב שוב מההתחלה
      return <FractalRuleCard key={step} title={t2.fractal_title} text={t2.fractal_text} />;
    case "2-room":
      return <WhoIsInRoom groups={groups} content={stage2Content} />;
    case "6-tips":
      return (
        <main className="rl-page rl-page--riddle" dir="rtl">
          <div className="rl-grid" aria-hidden="true" />
          <TipChat
            open
            displayOnly
            onClose={() => {}}
            title={t6.tips_title}
            tips={stage6Content?.tips?.length ? stage6Content.tips : DEFAULT_TIPS}
            confirmLabel=""
            manualCount={step}
          />
        </main>
      );
    case "7":
      return <RoomRecordings groups={groups} manualIndex={step} />;
    case "10":
      return <RoomPrinciple workshopId={groups[0]?.workshop_id ?? ""} />;
    default:
      return ROOM_LOOPS[itemKey] ? <RoomLoop loop={ROOM_LOOPS[itemKey]} manualIndex={step} /> : null;
  }
}

/*
 * "כלל הפרקטל" בגלריית הלופים (2026-11-24, "שכלל הפרקטל יהיה ברור יותר"):
 * במסך המלא הכלל נבנה מגרגרי חול (FractalFullscreen), אבל בחלון קטן הגרגרים
 * נראים כפסיפס שלא נקרא. כאן - דף כחול עם הכותרת, המשפט בגדול מילה אחר מילה,
 * וריבועים בתוך ריבועים כסמל הפרקטל. בגלריה הכול עובר בנגיעה: נגיעה = הכלל נכתב שוב.
 */
function FractalRuleCard({ title, text }: { title: string; text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <main className="rl-page rl-page--answer fr-page" dir="rtl">
      <div className="rl-grid" aria-hidden="true" />
      <svg className="fr-squares" viewBox="0 0 100 100" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((n) => {
          const inset = n * 10;
          return (
            <rect
              key={n}
              x={inset}
              y={inset}
              width={100 - inset * 2}
              height={100 - inset * 2}
              className={n === 4 ? "is-core" : undefined}
              style={{ animationDelay: `${n * 0.18}s` }}
            />
          );
        })}
      </svg>
      <section className="fr-body">
        <h1 className="fr-title">
          <span className="fr-title__sq" aria-hidden="true" />
          {title}
        </h1>
        <p className="fr-text">
          {words.map((w, i) => (
            <span key={i} className="fr-word" style={{ animationDelay: `${0.9 + i * 0.16}s` }}>
              {w}
            </span>
          ))}
        </p>
      </section>
    </main>
  );
}

/* --- שלב 1: ברוכות הבאות + לוגו פרקטל + לוגו הסמינר -------------------------
 * לפי הצילום שהלקוחה צירפה לאפיון (2026-11-19): בדיוק מסך הפתיחה של שלושת
 * המסכים - בלוק כחול עם לוגו פרקטל, "01" עם ריבוע אדום, "ברוכות הבאות" עם
 * החץ הדק - אבל בלי כפתור "התחילו" (המסך הגדול לצפייה בלבד). במקום הכפתור:
 * לוגו הסמינר. */
function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M19 5 L5 19 M5 8 L5 19 L16 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function RoomWelcome({ title }: { title?: string }) {
  const [seminarLogoOk, setSeminarLogoOk] = useState(true);
  const words = (title || "ברוכות הבאות").split(/\s+/).filter(Boolean);
  const delay = (s: number) => ({ animationDelay: `${s}s` });

  return (
    <main className="opening-editorial" dir="rtl">
      <div className="ed-grid" aria-hidden="true" />
      <div className="ed-hline ed-hline--top" aria-hidden="true" />
      <div className="ed-hline ed-hline--bottom" aria-hidden="true" />

      <section className="ed-panel">
        <div className="ed-panel__body">
          <img src="/brand/fractal-logo-on-dark.png" alt="פרקטל - עומק. מימד. חדשנות." className="ed-panel__logo" />
        </div>
      </section>

      <section className="ed-copy">
        <div className="ed-head ed-rise" style={delay(0.35)}>
          <div className="ed-index">
            <span className="ed-index__num">01</span>
            <span className="ed-index__square" aria-hidden="true" />
          </div>
        </div>

        <div className="ed-title-row ed-rise" style={delay(0.55)}>
          <h1 className="ed-title">
            {words.map((w, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {w}
              </span>
            ))}
          </h1>
          <DiagonalArrow className="ed-title-arrow" />
        </div>

        {/* במקום כפתור "התחילו" - לוגו הסמינר (עד שיגיע הקובץ, המקום ריק) */}
        <div className="ed-foot ed-rise" style={delay(0.85)}>
          {seminarLogoOk && (
            <img
              src={SEMINAR_LOGO}
              alt="הסמינר להוראה ויזניץ"
              className="rs-seminar-logo"
              onError={() => setSeminarLogoOk(false)}
            />
          )}
        </div>
      </section>
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
