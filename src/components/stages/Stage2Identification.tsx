import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";
import AutoPlayVideo from "../AutoPlayVideo";
import StageShell from "../StageShell";
import ZoomIntro from "../ZoomIntro";
import FractalSentence from "../FractalSentence";
import TipBubbles from "../TipBubbles";
import { LevelBadge } from "../ui/GameTile";
import Icon from "../ui/Icon";
import { GlassButton } from "../ui/Glass";
import { InlineNotice } from "../ui/Feedback";
import { BackgroundLayers } from "../ui/AppBackground";
import { cx } from "../../lib/cx";
import { playPop } from "../../lib/tapFeedback";

const MAX_PARTICIPANTS = 15;

/** טקסטי מסך "מי בחדר" - ניתנים לעריכה מה-DB (content.room). */
interface RoomTexts {
  intro: string;
  journey_title: string;
  after_line: string;
  after_bold: string;
  waiting: string;
  /** הכפתור שמעביר לסרטון הדילמה. */
  start_button: string;
}

const ROOM_DEFAULTS: RoomTexts = {
  intro: "התחברנו לחלקים, עכשיו רואים את התמונה.",
  journey_title: "איתנו במסע:",
  after_line: "כל קבוצה היא צורה אחרת,",
  after_bold: "עכשיו נראה איזו צורה תצליח לעשות שינוי בדפוס.",
  // לפי האפיון: "צוותים" ולא "קבוצות" בהודעת ההמתנה
  waiting: "המערכת ממתינה לכל הצוותים...",
  start_button: "אנחנו מתחילות, לצפייה בדילמה",
};

/** טקסטי מסע ההזדהות - כולם ניתנים לעריכה מה-DB (content.identification). */
interface IdentificationTexts {
  /** שורת המעבר שמופיעה בפתיחה, מעל "התחלקנה לשולחנות עבודה.". */
  shape_line: string;
  tables_title: string;
  tables_text?: string;
  participants_title: string;
  name_title: string;
  name_bonus?: string;
  tips_title: string;
  tips: { title: string; text: string }[];
  summary_title: string;
  /** המשפט במסך הסיכום (IV), מתחת לשם ולמשתתפות. */
  built_line: string;
  /** מופיע אחרי "שמירה והמשך", לפני "כלל הפרקטל" במסך מלא. */
  created_line: string;
  fractal_title: string;
  fractal_text: string;
}

interface Stage2Content {
  /** כתובת סרטון הדילמה. נקראת מהמסד ולא כתובה בקוד. */
  dilemma_video_url?: string;
  dilemma_title?: string;
  dilemma_text?: string;
  identification?: Partial<IdentificationTexts>;
  room?: Partial<RoomTexts>;
}

/*
  ברירות מחדל - הנוסח של הלקוחה מהאפיון. משמשות רק כשאין טקסט ב-DB
  (ראו supabase/stage2_identification_texts.sql, שמכניס אותם לתוכנית).
*/
const IDENTIFICATION_DEFAULTS: IdentificationTexts = {
  shape_line: "עכשיו משנים צורה, שמים את הפרקטל על השולחן.",
  tables_title: "התחלקנה לשולחנות עבודה.",
  participants_title: "הזינו את פרטי המשתתפות.",
  name_title: "בחרנה שם מקורי, קצר ומייצג לקבוצה,",
  name_bonus: "וצברו עליו ניקוד נוסף.",
  tips_title: "איך יוצרים שם שלא נשכח?",
  tips: [
    { title: "קצר", text: "מעט מילים, הרבה אופי." },
    { title: "קליט", text: "נכנס לראש ונשאר שם." },
    { title: "שלכן", text: "משקף משהו מהצורה, מהאופי או מהרעיון שלכן." },
    { title: "עם טוויסט", text: "חיבור מפתיע, משחק מילים, קריצה." },
    { title: "בלי הוראות הפעלה", text: "אם צריך להסביר אותו, הוא עוד לא מוכן." },
  ],
  summary_title: "הקבוצה שלנו:",
  built_line: "אתן כבר חלק מהצורה, בניתן לכן פרקטל.",
  created_line: "הקבוצה נוצרה בהצלחה",
  fractal_title: "כלל הפרקטל",
  fractal_text: "חלק קטן, אבל כבר רואים בו את השלם.",
};

interface Props {
  screenNumber: number;
  myGroup: Group;
  allGroups: Group[];
  content?: Stage2Content;
  onAdvance: () => void;
}

/* ==========================================================================
   א. טופס ההזדהות
   ========================================================================== */

/**
 * ----------------------------------------------------------------------------
 * ההזדהות כמסע קצר בארבעה צעדים (לפי האפיון של הלקוחה)
 * ----------------------------------------------------------------------------
 *   I    התחלקנה לשולחנות עבודה      - הוראה בלבד, בלי הזנה
 *   II   הזינו את פרטי המשתתפות      - שדה אחד + תגים (Enter מוסיף)
 *   III  בחרנה שם לקבוצה             - טיפים ש"קופצים" אחד-אחד + שדה השם
 *   ✓    סיכום                        - השם, המשתתפות ו"כלל הפרקטל"
 *
 * הכול על מסך אחד שמתחלף, בלי גלילה, והשמירה ל-DB קורית רק בסיכום - כך
 * אפשר לחזור צעד אחורה ולתקן בלי שום דבר חצי-שמור. כל הטקסטים מגיעים
 * מ-`content` (program_stages, שלב 2), עם ברירות מחדל לפי המסמך של הלקוחה.
 *
 * הזנת המשתתפות נשארת כמו קודם: שדה הקלדה אחד שנשאר בפוקוס (המקלדת לא
 * נסגרת בין שם לשם), נגיעה בתג מחזירה אותו לתיקון, × מסיר. שם שהוקלד
 * ולא נוסף נשמר גם הוא.
 */
type FormStep = "tables" | "participants" | "name" | "summary";
const FORM_STEPS: FormStep[] = ["tables", "participants", "name", "summary"];
const STEP_MARKS = ["I", "II", "III", "✓"];

/** כמה זמן "הקבוצה נוצרה בהצלחה" נשאר על המסך לפני "כלל הפרקטל". */
const CREATED_MS = 1800;

function IdentificationForm({
  myGroup,
  content,
  onSaved,
  onCelebrationEnd,
}: {
  myGroup: Group;
  content?: Stage2Content;
  /** נקרא רגע לפני הכתיבה למסד, כדי שההורה ישאיר את הטופס עד סוף החגיגה. */
  onSaved: () => void;
  onCelebrationEnd: () => void;
}) {
  const t = { ...IDENTIFICATION_DEFAULTS, ...(content?.identification ?? {}) };

  const [step, setStep] = useState<FormStep>("tables");
  const [name, setName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * אחרי השמירה: "created" - הודעת ההצלחה בכרטיס; "fractal" - כלל הפרקטל
   * על כל המסך, ובסופו עוברים לבד למסך הבא (לבקשת הלקוחה).
   */
  const [celebration, setCelebration] = useState<"none" | "created" | "fractal">("none");
  /**
   * פופ-אפ הטיפים לשם הקבוצה - קופץ ברגע שנוגעים בשדה השם כדי להתחיל
   * לכתוב (לבקשת הלקוחה, 2026-11-08), ולא בכניסה לצעד. פעם אחת בלבד:
   * כשהפופ-אפ נסגר, המיקוד חוזר לשדה, ובלי הדגל הוא היה קופץ שוב.
   */
  const [tipsOpen, setTipsOpen] = useState(false);
  const tipsShownRef = useRef(false);
  const draftRef = useRef<HTMLInputElement>(null);

  function openTips() {
    tipsShownRef.current = true;
    setTipsOpen(true);
    playPop();
  }

  const stepIndex = FORM_STEPS.indexOf(step);
  const isFull = participants.length >= MAX_PARTICIPANTS;
  const canAdd = draft.trim().length > 0 && !isFull;
  /** כל המשתתפות, כולל שם שהוקלד ולא נוסף. */
  const allNames = [...participants, draft.trim()].filter((p) => p.length > 0).slice(0, MAX_PARTICIPANTS);

  function addParticipant() {
    if (!canAdd) return;
    setParticipants((current) => [...current, draft.trim()]);
    setDraft("");
    draftRef.current?.focus();
  }

  function removeParticipant(index: number) {
    setParticipants((current) => current.filter((_, i) => i !== index));
  }

  function editParticipant(index: number) {
    const pending = draft.trim();
    setParticipants((current) => {
      const next = current.filter((_, i) => i !== index);
      return pending ? [...next, pending] : next;
    });
    setDraft(participants[index]);
    draftRef.current?.focus();
  }

  function goTo(next: FormStep) {
    // שם שהוקלד ולא נוסף נכנס לרשימה כשממשיכים - שלא ייעלם מהסיכום
    if (step === "participants" && draft.trim() && !isFull) {
      setParticipants((current) => [...current, draft.trim()]);
      setDraft("");
    }
    setStep(next);
  }

  async function handleSave() {
    if (!name.trim() || saving || celebration !== "none") return;
    setSaving(true);
    // קודם מודיעים להורה: ברגע שהשם נכתב למסד, Stage2Identification היה
    // מחליף את הטופס במסך "מי בחדר" - באמצע ההודעה ו"כלל הפרקטל"
    onSaved();
    // משתתפות לפני השם: השם הוא מה שמעביר את כל המסכים ל"מי בחדר", ושם
    // הקבוצה צריכה להופיע כבר עם המשתתפות שלה
    const rows = allNames.map((p) => ({ group_id: myGroup.id, name: p }));
    if (rows.length > 0) {
      await supabase.from("participants").insert(rows).then();
    }
    await supabase.from("groups").update({ name: name.trim() }).eq("id", myGroup.id).then();
    setSaving(false);
    setCelebration("created");
    window.setTimeout(() => setCelebration("fractal"), CREATED_MS);
  }

  const canContinue =
    step === "tables" ||
    (step === "participants" && allNames.length > 0) ||
    (step === "name" && name.trim().length > 0);

  return (
    <StageShell
      stage={2}
      kicker="הזדהות"
      icon="users"
      title="מי אתן?"
      // "הגדלנו זום" לא נכתב - הוא קורה: הכתב בשלב הזה גדול מהרגיל,
      // והמסך נפתח בצלילה לפרקטל (ZoomIntro)
      compactHeader
      // הכרטיס צר מהרווח שבין מד ההתקדמות לטיימר, אז הרצועה התחתונה פנויה
      tightBottom
      // התוכן מתחיל מיד מתחת ל"מי אתן?" - במרכוז אנכי נפער רווח גדול
      // בין הכותרת לשורת "עכשיו משנים צורה" (במסך מלא/נעול, שהוא גבוה יותר)
      center={false}
      background="ripple"
      width="wide"
      // "המשך" ו"חזרה" למטה הוסרו (מיותרים - יש חיצים בפינות הכרטיס, לבקשת
      // הלקוחה). נשאר רק "שמירה והמשך" בסיכום, שהוא פעולה ולא דפדוף.
      actions={
        step !== "summary" ? undefined : celebration === "none" ? (
          <GlassButton variant="primary" size="lg" icon="save" onClick={handleSave} loading={saving}>
            {saving ? "שומר..." : "שמירה והמשך"}
          </GlassButton>
        ) : (
          // הכפתור מתחלף בהודעת ההצלחה באותו מקום - כך אי אפשר ללחוץ פעמיים
          <span
            role="status"
            className="glass glass-raised btn-rect text-ink flex min-h-16 items-center gap-3 px-8 text-2xl font-extrabold"
            style={{ animation: "pop-in 0.5s var(--ds-ease-spring) both" }}
          >
            <span className="bubble bubble--1 flex h-10 w-10 items-center justify-center">
              <Icon name="check" size={22} />
            </span>
            {t.created_line}
          </span>
        )
      }
    >
      <ZoomIntro />

      {/* "כלל הפרקטל" על כל המסך: המשפט נבנה מאותיות פ-ר-ק-ט-ל קטנות, בלי
          להפוך לכתב מלא, ובסוף הבנייה עוברים לבד למסך הבא (לבקשת הלקוחה).
          portal ל-body: שכבה fixed בתוך המעבר המונפש נמדדת לא נכון (באג 6). */}
      {celebration === "fractal" &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex flex-col items-center px-8 pt-16 pb-10"
            style={{
              // אטום: השכבות הדקורטיביות שקופות, ובלי רקע מלא המסך הקודם נראה מבעד
              background: "linear-gradient(160deg, var(--ds-bg-from), var(--ds-bg-via), var(--ds-bg-to))",
              animation: "page-fade var(--ds-dur-slow) var(--ds-ease) both",
            }}
          >
            <BackgroundLayers variant="night" />
            <h2 className="glass-title relative flex-none text-5xl lg:text-6xl">{t.fractal_title}</h2>
            <FractalSentence
              text={t.fractal_text}
              letters="פרקטל"
              solid={false}
              grain={6}
              once
              onDone={onCelebrationEnd}
              className="relative min-h-0 w-full flex-1"
            />
          </div>,
          document.body,
        )}

      {/*
        "שיקפצו חלוניות פופאפ" (לפי האפיון): בצעד III כל טיפ קופץ כחלונית
        נפרדת משלו, אחת אחרי השנייה, משני צידי הכרטיס - והן נשארות פתוחות
        בזמן שבוחרים שם. כל חלונית נסגרת ב-×, והנורה מקפיצה את כולן שוב.
        portal ל-body: אלמנט fixed בתוך אזור התוכן המונפש נמדד לא נכון (באג 6).
      */}
      {/* פופ-אפ הטיפים - נפתח לבד בכניסה לבחירת השם (ראו goTo) */}
      {step === "name" &&
        createPortal(
          <TipBubbles
            open={tipsOpen}
            onClose={() => {
              setTipsOpen(false);
              // חוזרים לשדה, כדי שאפשר יהיה להמשיך להקליד מיד
              window.setTimeout(() => document.getElementById("group-name")?.focus(), 50);
            }}
            title={t.tips_title}
            tips={t.tips}
          />,
          document.body,
        )}

      {/* שורת המעבר - מתחת ל"מי אתן?" ומעל מד הצעדים, בכל הצעדים.
          לבקשת הלקוחה (2026-11-08): צמודה לכותרת (מינוס-מרווח מבטל את
          הרווח של הכותרת), ובמשקל רגיל - רק "מי אתן?" בבולד. */}
      <p className="glass-title -mt-2 mb-7 flex-none text-center text-3xl font-normal sm:text-4xl lg:-mt-3">
        {t.shape_line}
      </p>

      {/* מד הצעדים: I · II · III · ✓ - עם רווח נדיב מעליו ומתחתיו (לבקשת הלקוחה) */}
      <ol className="mb-7 flex flex-none items-center justify-center gap-2" aria-label="שלבי ההזדהות">
        {STEP_MARKS.map((mark, i) => (
          <li key={mark} className="flex items-center gap-2">
            <span
              aria-current={i === stepIndex ? "step" : undefined}
              className={cx(
                "flex h-10 w-10 items-center justify-center text-sm font-extrabold transition-all duration-300",
                i <= stepIndex ? `bubble bubble--${i + 1}` : "bubble bubble-hollow text-ink-3",
                i === stepIndex && "scale-110",
              )}
            >
              {mark}
            </span>
            {i < STEP_MARKS.length - 1 && (
              <span
                aria-hidden="true"
                className={cx("h-0.5 w-10 rounded-full", i < stepIndex ? "bg-accent" : "bg-edge")}
              />
            )}
          </li>
        ))}
      </ol>

      <div
        key={step}
        // מתכווץ לגובה הפנוי - המסגרת תמיד שלמה; רק התגים גוללים בפנים אם צריך
        className={cx(
          // pt-14: מקום לחיצי הניווט בפינות העליונות, כדי שלא יעלו על הכותרת
          "glass glass-brick glass-raised relative flex min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl px-5 pt-14 pb-5 sm:px-6 sm:pb-6",
          /*
            "יותר משחק, על מסך מלא" (בקשת הלקוחה, 2026-11-08): הכרטיס ממלא
            את כל הגובה הפנוי, כמו לוח האריחים בשלב 5, במקום רצועה בשליש
            העליון. רק מ-1700px: הכרטיס יורד עד התחתית, ובמסך צר יותר הוא
            היה נוגע במד ההתקדמות ובטיימר שבפינות.
          */
          "min-[1700px]:flex-1",
          step === "tables" && "glass-interactive glass-3d cursor-pointer",
        )}
        style={{ animation: "pop-in var(--ds-dur-slow) var(--ds-ease-spring) both" }}
        // בצעד I אין מה להזין - נגיעה בכרטיס עצמו מעבירה לצעד הבא (לבקשת
        // הלקוחה), כמו "המשך"
        {...(step === "tables"
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `${t.tables_title} - המשך`,
              onClick: () => goTo("participants"),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goTo("participants");
                }
              },
            }
          : {})}
      >
        {/* חיצי ניווט בתוך הכרטיס (לבקשת הלקוחה): חזרה בצד ימין, המשך בצד
            שמאל - כמו דפדוף. stopPropagation: בצעד I כל הכרטיס לחיץ. */}
        {stepIndex > 0 && (
          <CardArrow
            dir="back"
            onClick={(e) => {
              e.stopPropagation();
              setStep(FORM_STEPS[stepIndex - 1]);
            }}
          />
        )}
        {step !== "summary" && (
          <CardArrow
            dir="next"
            disabled={!canContinue}
            onClick={(e) => {
              e.stopPropagation();
              goTo(FORM_STEPS[stepIndex + 1]);
            }}
          />
        )}

        {/* ---------- I. שולחנות עבודה ---------- */}
        {step === "tables" && (
          // מסך "כניסה לשלב" כמו במשחק: תג מעוין גדול וכותרת ענקית באמצע הלוח
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center">
            <LevelBadge value="I" label="" size={140} />
            <p className="text-ink text-4xl font-extrabold sm:text-5xl lg:text-6xl">{t.tables_title}</p>
            {t.tables_text && <p className="text-ink-2 max-w-xl text-lg">{t.tables_text}</p>}
          </div>
        )}

        {/* ---------- II. פרטי המשתתפות ---------- */}
        {step === "participants" && (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-none items-center justify-between gap-3">
              <h2 className="text-ink flex items-center gap-4 text-3xl font-extrabold">
                <LevelBadge value="II" label="" size={68} className="flex-none" />
                {t.participants_title}
              </h2>
              <span className="text-ink-3 text-sm font-bold tabular-nums">
                {participants.length} / {MAX_PARTICIPANTS}
              </span>
            </div>

            {isFull ? (
              <InlineNotice tone="info">
                הגעתן למספר המשתתפות המרבי בקבוצה ({MAX_PARTICIPANTS}).
              </InlineNotice>
            ) : (
              <input
                id="participant-draft"
                ref={draftRef}
                autoFocus
                className="glass-input flex-none !min-h-[3.5rem] !text-2xl"
                placeholder="שם המשתתפת - ו-Enter"
                aria-label="שם משתתפת"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addParticipant();
                  }
                }}
                enterKeyHint="enter"
                autoComplete="off"
              />
            )}

            {participants.length > 0 ? (
              <ul className="glass-scroll -m-2 grid min-h-0 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] content-start gap-x-2 gap-y-1.5 overflow-y-auto p-2">
                {participants.map((p, i) => (
                  <ParticipantChip
                    key={`${i}-${p}`}
                    index={i}
                    name={p}
                    onEdit={() => editParticipant(i)}
                    onRemove={() => removeParticipant(i)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-ink-3 py-4 text-center text-base">
                כל שם שתוסיפו יופיע כאן. נגיעה בשם מאפשרת לתקן אותו.
              </p>
            )}
          </div>
        )}

        {/* ---------- III. שם הקבוצה (הטיפים בפופ-אפ, ראו למטה) ---------- */}
        {step === "name" && (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 py-2 text-center">
            <h2 className="text-ink flex items-center gap-4 text-3xl font-extrabold sm:text-4xl">
              <LevelBadge value="III" label="" size={76} className="flex-none" />
              {t.name_title}
            </h2>
            {t.name_bonus && (
              <p className="text-ink-2 flex items-center gap-2 text-2xl font-bold">
                <Icon name="star" size={22} filled className="text-accent" />
                {t.name_bonus}
              </p>
            )}
            <div className="flex w-full items-center gap-3">
              {/* בלי autoFocus: הפופ-אפ קופץ בנגיעה בשדה, ומיקוד אוטומטי היה
                  מקפיץ אותו כבר בכניסה לצעד */}
              <input
                id="group-name"
                className="glass-input !min-h-[4.25rem] !text-3xl"
                placeholder="שם הקבוצה"
                aria-label="שם הקבוצה"
                value={name}
                onFocus={() => {
                  if (!tipsShownRef.current) openTips();
                }}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    e.preventDefault();
                    goTo("summary");
                  }
                }}
                enterKeyHint="next"
                autoComplete="off"
              />
              {/* פותח שוב את פופ-אפ הטיפים */}
              <GlassButton icon="lightbulb" onClick={openTips} className="flex-none">
                טיפים
              </GlassButton>
            </div>
          </div>
        )}

        {/* ---------- ✓ סיכום ---------- */}
        {step === "summary" && (
          <div className="center-safe flex min-h-0 flex-1 flex-col items-center gap-3 text-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-ink-3 text-lg font-bold">{t.summary_title}</span>
              <p className="glass-title text-5xl">{name.trim()}</p>
            </div>

            {allNames.length > 0 && (
              <ul className="flex max-w-3xl flex-wrap justify-center gap-2">
                {allNames.map((p, i) => (
                  <li
                    key={`${i}-${p}`}
                    className="glass glass-raised glass-pill gap-2 py-1 ps-1 pe-4"
                    style={{ animation: `pop-in 0.45s ${i * 0.06}s var(--ds-ease-spring) both` }}
                  >
                    <span
                      aria-hidden="true"
                      className={`bubble bubble--${(i % 5) + 1} flex h-7 w-7 items-center justify-center text-[11px] font-extrabold`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-ink text-lg font-bold">{p}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* "כלל הפרקטל" עבר למסך מלא אחרי השמירה (ראו celebration). כאן
                נשאר המשפט שסוגר את ההזדהות. */}
            <p
              className="glass-title mt-6 max-w-4xl text-4xl lg:text-5xl"
              style={{ animation: "fade-up 0.7s 0.4s var(--ds-ease) both" }}
            >
              {t.built_line}
            </p>
          </div>
        )}
      </div>
    </StageShell>
  );
}

/**
 * חץ צבעוני בפינה העליונה של הכרטיס - החץ עצמו בגרדיאנט הקשת, בלי עיגול
 * סביבו (לבקשת הלקוחה). חזרה בפינה הימנית, המשך בשמאלית (RTL - כמו דפדוף).
 * "המשך" מתנדנד קלות לכיוון ההמשך; כשאי אפשר עוד להמשיך - שקוף ולא זז.
 */
function CardArrow({
  dir,
  onClick,
  disabled = false,
}: {
  dir: "back" | "next";
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const next = dir === "next";
  const gid = `card-arrow-${dir}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={next ? "המשך" : "חזרה"}
      className={cx(
        // אזור נגיעה גדול (56px) גם כשהחץ עצמו דק
        "absolute top-2 z-10 flex h-14 w-14 items-center justify-center transition-opacity duration-300",
        next ? "left-3" : "right-3",
        disabled && "opacity-30",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={38}
        height={38}
        fill="none"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={
          next && !disabled ? { animation: "swipe-sway 1.6s var(--ds-ease) infinite" } : undefined
        }
      >
        <defs>
          {/* userSpaceOnUse: הקו האופקי של החץ בגובה 0, ובמצב ברירת המחדל
              (objectBoundingBox) גרדיאנט על קו כזה לא מצויר בכלל */}
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="24" y1="0" x2="0" y2="24">
            <stop offset="0%" style={{ stopColor: "var(--ds-rainbow-1)" }} />
            <stop offset="50%" style={{ stopColor: "var(--ds-rainbow-3)" }} />
            <stop offset="100%" style={{ stopColor: "var(--ds-rainbow-4)" }} />
          </linearGradient>
        </defs>
        {next ? (
          // חץ שמאלה = המשך
          <g stroke={`url(#${gid})`}>
            <path d="M19 12H5" />
            <path d="m11 6-6 6 6 6" />
          </g>
        ) : (
          // חץ ימינה = חזרה
          <g stroke={`url(#${gid})`}>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </g>
        )}
      </svg>
    </button>
  );
}

/** תג משתתפת: נגיעה בשם - לתיקון, × - הסרה. */
function ParticipantChip({
  index,
  name,
  onEdit,
  onRemove,
}: {
  index: number;
  name: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className="glass glass-raised glass-pill flex min-w-0 items-center justify-between gap-0.5 py-0.5 ps-1 pe-0.5"
      style={{ animation: "glass-in var(--ds-dur) var(--ds-ease) both" }}
    >
      <button
        type="button"
        onClick={onEdit}
        title="לתיקון השם"
        className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 btn-rect"
      >
        <span
          aria-hidden="true"
          className={`bubble bubble--${(index % 5) + 1} flex h-7 w-7 flex-none items-center justify-center text-[11px] font-extrabold`}
        >
          {index + 1}
        </span>
        <span className="text-ink truncate text-lg font-bold">{name}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`הסרת ${name}`}
        className="text-ink-3 hover:text-ink flex h-9 w-9 flex-none items-center justify-center btn-rect transition-colors"
      >
        <Icon name="close" size={15} />
      </button>
    </li>
  );
}

/* ==========================================================================
   ב. מצב החדר
   ========================================================================== */

function RoomStatusNames({
  allGroups,
  content,
  onNext,
}: {
  allGroups: Group[];
  content?: Stage2Content;
  onNext: () => void;
}) {
  const t = { ...ROOM_DEFAULTS, ...(content?.room ?? {}) };
  const groupIds = allGroups.map((g) => g.id);
  const participants = useParticipants(groupIds);
  const allIdentified = allGroups.every((g) => g.name);

  return (
    <StageShell
      stage={2}
      kicker="מצב החדר"
      icon="users"
      title="מי בחדר"
      // קצת אוויר בין הכותרת לשורת ההסבר (בקשת הלקוחה, 2026-11-08)
      subtitle={<span className="mt-2 inline-block">{t.intro}</span>}
      background="ripple"
      width="wide"
      compactHeader
      actions={
        /*
          "אחרי החלוניות" יושב באזור הפעולות התחתון ולא באזור התוכן: אזור
          התוכן מתכווץ ונחתך במסך נמוך/נעול, ואזור הפעולות קבוע - כך המשפט
          אף פעם לא נחתך, ותמיד צמוד מעל הכפתור / הודעת ההמתנה.
        */
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-0.5 text-center">
            <p className="text-ink-2 text-xl">{t.after_line}</p>
            <p className="glass-title pb-1 text-3xl">{t.after_bold}</p>
          </div>
          {allIdentified ? (
            <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onNext}>
              {t.start_button}
            </GlassButton>
          ) : (
            <span className="glass glass-pill text-ink-2 gap-2.5 px-5 py-2.5 text-base font-bold">
              <Icon name="hourglass" size={18} className="text-accent-soft" />
              {t.waiting}
            </span>
          )}
        </div>
      }
    >
      {/* "איפה אנחנו במסע:" - כותרת לשלוש החלוניות */}
      <h2 className="text-ink mb-4 flex-none text-center text-3xl font-extrabold">{t.journey_title}</h2>

      <ul className="grid w-full flex-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g, i) => {
            const groupParticipants = participants.filter((p) => p.group_id === g.id);
            const identified = Boolean(g.name);

            return (
              /*
                חלונית לפי התבנית שבאפיון: "קבוצה: ____ / משתתפות: ____".
                שתי שורות עם כותרת מודגשת והערך לצידה (בלי קווים מקווקווים -
                לבקשת הלקוחה). כל עוד הקבוצה לא הזדהתה, הערך ריק.
                החלוניות "קופצות" אחת אחרי השנייה.
              */
              <li
                key={g.id}
                className="glass glass-brick glass-raised relative flex flex-col gap-5 rounded-2xl p-6 text-start"
                style={{
                  animation: `pop-in 0.55s ${0.15 + i * 0.3}s var(--ds-ease-spring) both`,
                }}
              >
                {/* העיגול בפינה השמאלית העליונה ולא בתחילת השורה - כך "קבוצה:"
                    ו"משתתפות:" מתחילות בדיוק באותו קו, אחת מתחת לשנייה */}
                <span
                    aria-hidden="true"
                    className={cx(
                      "absolute top-5 left-5 flex h-11 w-11 items-center justify-center text-base font-extrabold",
                      identified
                        ? `bubble bubble--${((g.screen_number - 1) % 5) + 1}`
                        : "bubble bubble-hollow text-ink-3",
                    )}
                  >
                    {identified ? <Icon name="check" size={20} /> : g.screen_number}
                  </span>
                <div className="flex items-end gap-3 pe-14">
                  <span className="text-ink flex-none text-xl font-extrabold">קבוצה:</span>
                  <span
                    className={cx(
                      "min-w-0 flex-1 pb-0.5 text-2xl font-extrabold",
                      // italic בלי truncate ועם ריווח: אות נטויה אחרונה נחתכה בקצה
                      identified ? "text-ink truncate" : "text-ink-3 pe-2 text-xl font-bold italic",
                    )}
                  >
                    {g.name ?? "טרם הזדהו"}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-ink flex-none pt-1 text-xl font-extrabold">משתתפות:</span>
                  <div className="min-h-[2.25rem] min-w-0 flex-1 pb-1">
                    {groupParticipants.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {groupParticipants.map((p) => (
                          <li key={p.id} className="glass glass-dim glass-chip text-ink !text-base">
                            {p.name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    </StageShell>
  );
}

/* ==========================================================================
   ג. סרטון הדילמה
   ========================================================================== */

/**
 * מסך סרטון הדילמה.
 *
 * יש כאן כפתור "המשך" מאותה סיבה בדיוק שבגללה הוא נוסף לתשובה הנכונה
 * בשלב 5 (ראו סעיף 10 ב-CLAUDE.md): בלעדיו קבוצה שסיימה לצפות יושבת מול
 * מסך נעול עד שהשעון ייגמר. הטיימר עדיין מעביר לבד אם לא לוחצים.
 */
function DilemmaVideo({
  content,
  onAdvance,
}: {
  content?: Stage2Content;
  onAdvance: () => void;
}) {
  /*
    לפי האפיון: "הצגת הדילמה על כל שטח המסך, ואחר כך יעבור מיד למסך הבא
    בלי טקסט נוסף". הסרטון ממלא את כל המסך (מעל הסרגל, המד והטיימר),
    בלי כותרת, בלי פקדים ובלי כפתור, מתנגן פעם אחת, ובסופו עוברים
    לבד לשלב הבא. אם הסרטון לא נטען (למשל חסימת סינון לקובצי וידאו,
    סעיף 9 ב-CLAUDE.md) - גם אז ממשיכים, כדי שהקבוצה לא תיתקע מול מסך שחור.
    portal ל-body: שכבה fixed בתוך המעבר המונפש נמדדת לא נכון (באג 6).
  */
  if (content?.dilemma_video_url) {
    return createPortal(
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black">
        <AutoPlayVideo
          src={content.dilemma_video_url}
          fill
          loop={false}
          controls={false}
          soundHint={false}
          onEnded={onAdvance}
          onError={onAdvance}
          className="h-full w-full object-contain"
        />
      </div>,
      document.body,
    );
  }

  // בלי סרטון בתוכנית (פיתוח/תוכן שעוד לא הגיע): מקום שמור + המשך ידני
  return (
    <StageShell
      stage={2}
      kicker="הדילמה"
      icon="film"
      title={content?.dilemma_title ?? "הדילמה הפדגוגית"}
      // בלי שורת תיאור ובריווח תחתון מינימלי - כל הגובה הולך לסרטון.
      // טקסט דילמה מהתוכנית, אם יש, עדיין מוצג.
      subtitle={content?.dilemma_text}
      background="quiet"
      width="full"
      compactHeader
      tightBottom
      actions={
        <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onAdvance}>
          המשך
        </GlassButton>
      }
    >
        <div className="glass glass-brick mx-auto flex aspect-video h-full max-h-full max-w-full items-center justify-center rounded-2xl">
          <div className="text-ink-3 flex flex-col items-center gap-3">
            <span className="glass glass-dim glass-icon-btn glass-icon-btn-lg">
              <Icon name="film" size={30} />
            </span>
            <span className="text-sm font-bold">כאן יופיע סרטון הדילמה</span>
          </div>
        </div>
    </StageShell>
  );
}

/* ==========================================================================
   הרכבה
   ========================================================================== */

function RoomStatus({
  allGroups,
  content,
  onAdvance,
}: {
  allGroups: Group[];
  content?: Stage2Content;
  onAdvance: () => void;
}) {
  const [showingVideo, setShowingVideo] = useState(false);

  if (showingVideo) {
    return <DilemmaVideo content={content} onAdvance={onAdvance} />;
  }
  return <RoomStatusNames allGroups={allGroups} content={content} onNext={() => setShowingVideo(true)} />;
}

function Stage2Identification({ myGroup, allGroups, content, onAdvance }: Props) {
  // אחרי השמירה הטופס נשאר על המסך עד סוף "כלל הפרקטל", גם כשהשם כבר
  // הגיע מהמסד. רענון באמצע מדלג ישר ל"מי בחדר" - וזה בסדר, הכול כבר שמור.
  const [celebrating, setCelebrating] = useState(false);

  if (!myGroup.name || celebrating) {
    return (
      <IdentificationForm
        myGroup={myGroup}
        content={content}
        onSaved={() => setCelebrating(true)}
        onCelebrationEnd={() => setCelebrating(false)}
      />
    );
  }
  return <RoomStatus allGroups={allGroups} content={content} onAdvance={onAdvance} />;
}

export default Stage2Identification;
