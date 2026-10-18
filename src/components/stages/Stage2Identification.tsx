import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";
import AutoPlayVideo from "../AutoPlayVideo";
import StageShell from "../StageShell";
import ZoomIntro from "../ZoomIntro";
import FractalSentence from "../FractalSentence";
import TipPopups from "../TipPopups";
import Icon from "../ui/Icon";
import { GlassButton } from "../ui/Glass";
import { InlineNotice } from "../ui/Feedback";
import { useToast } from "../ui/Toast";
import { cx } from "../../lib/cx";

const MAX_PARTICIPANTS = 15;

/** טקסטי מסך "מי בחדר" - ניתנים לעריכה מה-DB (content.room). */
interface RoomTexts {
  intro: string;
  journey_title: string;
  after_line: string;
  after_bold: string;
  waiting: string;
}

const ROOM_DEFAULTS: RoomTexts = {
  intro: "התחברנו לחלקים. עכשיו רואים את התמונה.",
  journey_title: "איפה אנחנו במסע:",
  after_line: "כל קבוצה היא צורה אחרת. עכשיו נראה",
  after_bold: "איזו צורה תצליח לעשות שינוי בדפוס.",
  // לפי האפיון: "צוותים" ולא "קבוצות" בהודעת ההמתנה
  waiting: "המערכת ממתינה לכל הצוותים",
};

/** טקסטי מסע ההזדהות - כולם ניתנים לעריכה מה-DB (content.identification). */
interface IdentificationTexts {
  /** שורת המעבר שמופיעה בפתיחה, מעל "התחלקנה לשולחנות עבודה". */
  shape_line: string;
  tables_title: string;
  tables_text?: string;
  participants_title: string;
  name_title: string;
  name_bonus?: string;
  tips_title: string;
  tips: { title: string; text: string }[];
  summary_title: string;
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
  shape_line: "עכשיו משנים צורה, שמים את הפרקטל על השולחן",
  tables_title: "התחלקנה לשולחנות עבודה",
  participants_title: "הזינו את פרטי המשתתפות",
  name_title: "בחרנה שם מקורי, קצר ומייצג לקבוצה",
  name_bonus: "וצברו עליו ניקוד נוסף",
  tips_title: "איך יוצרים שם שלא נשכח?",
  tips: [
    { title: "קצר", text: "מעט מילים, הרבה אופי." },
    { title: "קליט", text: "נכנס לראש ונשאר שם." },
    { title: "שלכן", text: "משקף משהו מהצורה, מהאופי או מהרעיון שלכן." },
    { title: "עם טוויסט", text: "חיבור מפתיע, משחק מילים, קריצה." },
    { title: "בלי הוראות הפעלה", text: "אם צריך להסביר אותו, הוא עוד לא מוכן." },
  ],
  summary_title: "זו הקבוצה שלנו",
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

function IdentificationForm({ myGroup, content }: { myGroup: Group; content?: Stage2Content }) {
  const t = { ...IDENTIFICATION_DEFAULTS, ...(content?.identification ?? {}) };

  const [step, setStep] = useState<FormStep>("tables");
  const [name, setName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  /** חלוניות טיפים שנסגרו ב-× (בצעד III). הנורה מחזירה את כולן. */
  const [hiddenTips, setHiddenTips] = useState<number[]>([]);
  const draftRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
    if (next === "name") setHiddenTips([]);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("groups").update({ name: name.trim() }).eq("id", myGroup.id).then();
    const rows = allNames.map((p) => ({ group_id: myGroup.id, name: p }));
    if (rows.length > 0) {
      await supabase.from("participants").insert(rows).then();
    }
    setSaving(false);
    toast(`נרשמתן כ"${name.trim()}"`, { tone: "ok", icon: "users" });
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
      actions={
        <div className="flex flex-wrap items-center justify-center gap-4">
          {stepIndex > 0 && (
            <GlassButton icon="arrowBack" onClick={() => setStep(FORM_STEPS[stepIndex - 1])}>
              חזרה
            </GlassButton>
          )}
          {step === "summary" ? (
            <GlassButton variant="primary" size="lg" icon="save" onClick={handleSave} loading={saving}>
              {saving ? "שומר..." : "שמירה והמשך"}
            </GlassButton>
          ) : (
            <GlassButton
              variant="primary"
              size="lg"
              iconAfter="arrowNext"
              onClick={() => goTo(FORM_STEPS[stepIndex + 1])}
              disabled={!canContinue}
            >
              המשך
            </GlassButton>
          )}
        </div>
      }
    >
      <ZoomIntro />

      {/*
        "שיקפצו חלוניות פופאפ" (לפי האפיון): בצעד III כל טיפ קופץ כחלונית
        נפרדת משלו, אחת אחרי השנייה, משני צידי הכרטיס - והן נשארות פתוחות
        בזמן שבוחרים שם. כל חלונית נסגרת ב-×, והנורה מקפיצה את כולן שוב.
        portal ל-body: אלמנט fixed בתוך אזור התוכן המונפש נמדד לא נכון (באג 6).
      */}
      {step === "name" &&
        createPortal(
          <TipPopups
            title={t.tips_title}
            tips={t.tips}
            hidden={hiddenTips}
            onClose={(i) => setHiddenTips((h) => [...h, i])}
          />,
          document.body,
        )}

      {/* שורת המעבר - מתחת ל"מי אתן?" ומעל מד הצעדים, בכל הצעדים */}
      <p className="glass-title mt-2 mb-4 flex-none text-center text-3xl sm:text-4xl">{t.shape_line}</p>

      {/* מד הצעדים: I · II · III · ✓ */}
      <ol className="mb-3 flex flex-none items-center justify-center gap-2" aria-label="שלבי ההזדהות">
        {STEP_MARKS.map((mark, i) => (
          <li key={mark} className="flex items-center gap-2">
            <span
              aria-current={i === stepIndex ? "step" : undefined}
              className={cx(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold transition-all duration-300",
                i <= stepIndex ? `bubble bubble--${i + 1}` : "bubble bubble-hollow text-ink-3",
                i === stepIndex && "scale-110",
              )}
            >
              {mark}
            </span>
            {i < STEP_MARKS.length - 1 && (
              <span
                aria-hidden="true"
                className={cx("h-0.5 w-8 rounded-full", i < stepIndex ? "bg-accent" : "bg-edge")}
              />
            )}
          </li>
        ))}
      </ol>

      <div
        key={step}
        // מתכווץ לגובה הפנוי - המסגרת תמיד שלמה; רק התגים גוללים בפנים אם צריך
        className="glass glass-brick glass-raised flex min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl p-5 sm:p-6"
        style={{ animation: "pop-in var(--ds-dur-slow) var(--ds-ease-spring) both" }}
      >
        {/* ---------- I. שולחנות עבודה ---------- */}
        {step === "tables" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="bubble bubble--1 flex h-20 w-20 items-center justify-center text-3xl font-extrabold">
              I
            </span>
            <p className="text-ink text-4xl font-extrabold sm:text-5xl">{t.tables_title}</p>
            {t.tables_text && <p className="text-ink-2 max-w-xl text-lg">{t.tables_text}</p>}
          </div>
        )}

        {/* ---------- II. פרטי המשתתפות ---------- */}
        {step === "participants" && (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-none items-center justify-between gap-3">
              <h2 className="text-ink flex items-center gap-3 text-3xl font-extrabold">
                <span className="bubble bubble--2 flex h-11 w-11 flex-none items-center justify-center text-base font-extrabold">
                  II
                </span>
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
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 py-2 text-center">
            <h2 className="text-ink flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
              <span className="bubble bubble--3 flex h-12 w-12 flex-none items-center justify-center text-base font-extrabold">
                III
              </span>
              {t.name_title}
            </h2>
            {t.name_bonus && (
              <p className="text-ink-2 flex items-center gap-2 text-2xl font-bold">
                <Icon name="star" size={22} filled className="text-accent" />
                {t.name_bonus}
              </p>
            )}
            <div className="flex w-full items-center gap-3">
              <input
                id="group-name"
                autoFocus
                className="glass-input !min-h-[4.25rem] !text-3xl"
                placeholder="שם הקבוצה"
                aria-label="שם הקבוצה"
                value={name}
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
              {hiddenTips.length > 0 && (
                <GlassButton icon="lightbulb" onClick={() => setHiddenTips([])} className="flex-none">
                  טיפים
                </GlassButton>
              )}
            </div>
          </div>
        )}

        {/* ---------- ✓ סיכום ---------- */}
        {step === "summary" && (
          <div className="flex min-h-0 flex-1 flex-col items-center gap-3 text-center">
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

            {/* כלל הפרקטל - המשפט נבנה מאותיות קטנות שמסתחררות במערבולת,
                כמו ה-G בסרטון של הלקוחה (ראו FractalSentence) */}
            {/* האזור מתכווץ לגובה הפנוי (min-h-0 flex-1) - המשפט אף פעם לא
                נחתך בשפה התחתונה של הכרטיס, גם במסך נמוך */}
            <div className="flex min-h-0 w-full max-w-4xl flex-[0_1_auto] flex-col items-center gap-1">
              <span className="text-accent-soft flex flex-none items-center gap-2 text-lg font-extrabold">
                <Icon name="sparkles" size={18} />
                {t.fractal_title}
              </span>
              <FractalSentence text={t.fractal_text} className="h-32 min-h-10 w-full flex-[0_1_auto]" />
            </div>
          </div>
        )}
      </div>
    </StageShell>
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
        className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full"
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
        className="text-ink-3 hover:text-ink flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors"
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
      subtitle={t.intro}
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
              לצפייה בדילמה
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
  if (!myGroup.name) {
    return <IdentificationForm myGroup={myGroup} content={content} />;
  }
  return <RoomStatus allGroups={allGroups} content={content} onAdvance={onAdvance} />;
}

export default Stage2Identification;
