import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";
import AutoPlayVideo from "../AutoPlayVideo";
import StageShell from "../StageShell";
import FractalFullscreen from "../FractalFullscreen";
import TipBubbles from "../TipBubbles";
import Icon from "../ui/Icon";
import { GlassButton } from "../ui/Glass";
import { cx } from "../../lib/cx";
import { revealGrid, useCurtainHeld } from "../../lib/gridCurtain";
import { setStageSubProgress } from "../../lib/stageProgress";
import { playChime, playPop, playSuccess, playWhoosh } from "../../lib/tapFeedback";
import { IDENTIFICATION_DEFAULTS, ROOM_DEFAULTS, type IdentificationTexts, type RoomTexts } from "../../lib/identificationTexts";

/* עוצמות הצלילים בהזדהות - "יותר בקול ויותר דרמטי" (בקשת הלקוחה, 2026-11-08).
   עוברות דרך מדחס ב-tapFeedback, כך שגם בעוצמה הזו אין עיוות. */
const SOUND_STEP = 0.5;
const SOUND_POP = 0.32;

const MAX_PARTICIPANTS = 15;



interface Stage2Content {
  /** כתובת סרטון הדילמה. נקראת מהמסד ולא כתובה בקוד. */
  dilemma_video_url?: string;
  dilemma_title?: string;
  dilemma_text?: string;
  identification?: Partial<IdentificationTexts>;
  room?: Partial<RoomTexts>;
}

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
/* ספרות ולא ספרות רומיות: ב-Heebo דק, I / II / III נקראו כפסים (2026-11-12) */
const STEP_MARKS = ["1", "2", "3", "✓"];
/** שמות הצעדים במד האנכי שבבלוק הכחול (עיצוב "עיתונאי", 2026-11-12). */
/* הוסרו ב-2026-11-15 והוחזרו באותו יום לבקשת המפתחת */
const STEP_LABELS = ["שולחנות", "משתתפות", "שם הקבוצה", "סיכום"];

/* ==========================================================================
   אפקטים למסך המלא של ההזדהות (בקשת הלקוחה, 2026-11-08: "תצוגה מעניינת,
   אפקט מרהיב, רעיון יצירתי ומגוון") - לכל צעד אפקט משלו
   ========================================================================== */

/* (PopWords - מילים שקופצות עם הטיה - הוסר עם המעבר לשפת "עיתונאי",
   2026-11-12: התנועה כאן רגועה, כמו במסך הפתיחה) */

/**
 * קטע תוכן שנכנס בזה אחר זה (בקשת הלקוחה, 2026-11-08: "אפקט של החלונות
 * שמופיעות, כמו הטיפים" - ואחר כך "בלי מסגרות" ו"לא עד כדי בלאגן"): בלי
 * לבנה ובלי מסגרת, רק החלקה קצרה פנימה, כל קטע מכיוון משלו, לפי delay.
 */
function Win({
  delay = 0,
  from = "up",
  className,
  bodyClassName,
  children,
}: {
  delay?: number;
  from?: "up" | "down" | "left" | "right";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  // תנועה קצרה ועדינה (בקשת הלקוחה: "מעניין, אבל לא עד כדי בלאגן") -
  // מחליק פנימה מקרוב, בלי מעוף מקצה המסך ובלי סיבוב חזק
  const fx = from === "left" ? "-6vw" : from === "right" ? "6vw" : "0px";
  const fy = from === "up" ? "-5vh" : from === "down" ? "5vh" : "0px";
  const fr = "0deg";
  /*
    **בלי מסגרות** (בקשת הלקוחה, 2026-11-08: "סגנון אחר, בלי מסגרות"): אין
    לבנת זכוכית ואין פס חלון - התוכן עצמו עף פנימה ונוחת, ישר על הרקע.
    נשארה רק התנועה: כל "חלון" מגיע מכיוון משלו, בזה אחר זה.
  */
  return (
    <div
      className={cx("relative flex flex-col", className)}
      style={
        {
          "--fx": fx,
          "--fy": fy,
          "--fr": fr,
          animation: `glide-in 0.7s ${delay}s var(--ds-ease) both`,
        } as React.CSSProperties
      }
    >
      <div className={cx("flex flex-col px-2 py-2", bodyClassName)}>{children}</div>
    </div>
  );
}

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
  /*
    בכניסה הראשונה הכותרת "מי אתן?" עולה קודם, וההוראה של צעד 1 אחריה.
    בחזרה לצעד 1 - בלי השהיה.
  */
  const [firstEntry, setFirstEntry] = useState(true);
  const introOffset = firstEntry && step === "tables" ? 0.4 : 0;
  /* מעבר "רשת הריבועים" מ"ברוכות הבאות" (gridCurtain.ts): כל עוד הרשת
     מכסה, אנימציות הכניסה כאן מושהות; ברגע שהמסך עלה - מבקשים גילוי. */
  const curtainHeld = useCurtainHeld();
  useEffect(() => {
    revealGrid();
  }, []);
  // פס ההתקדמות הכתום בראש המסך מתקדם גם בין צעדי ההזדהות: ההזדהות היא
  // כשני שלישים מהשלב (אחריה "מי בחדר" והדילמה), והשמירה סוגרת אותה
  useEffect(() => {
    const done = celebration !== "none" ? FORM_STEPS.length : FORM_STEPS.indexOf(step);
    setStageSubProgress((done / FORM_STEPS.length) * 0.66);
  }, [step, celebration]);
  // סימון על body: פקדים שמחוץ למסך הזה (כפתור "חזרה לשלב הקודם" של
  // הסרגל העליון) מקבלים את המראה של שפת "עיתונאי" - גם בזמן "כלל
  // הפרקטל", שעכשיו הוא עמוד כחול באותה שפה
  useEffect(() => {
    document.body.classList.add("ed-active");
    return () => document.body.classList.remove("ed-active");
  }, []);
  /** כיוון הדפדוף האחרון - לפס הכחול שחוצה את הזירה (ed-sweep) */
  const [sweepDir, setSweepDir] = useState<"next" | "back">("next");

  function openTips() {
    tipsShownRef.current = true;
    setTipsOpen(true);
    playPop(SOUND_POP);
  }

  // מסך הסיכום: צלצול ברגע ששם הקבוצה סיים להופיע אות-אחר-אות
  useEffect(() => {
    if (step !== "summary") return;
    const id = window.setTimeout(playChime, (0.3 + name.trim().length * 0.06 + 0.4) * 1000);
    return () => window.clearTimeout(id);
    // name לא בתלויות: בסיכום השם כבר סופי, ולא רוצים צלצול נוסף
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
    playPop(SOUND_POP);
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
    setFirstEntry(false);
    setSweepDir("next");
    setStep(next);
    playWhoosh(SOUND_STEP, true);
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
    playSuccess();
    window.setTimeout(() => setCelebration("fractal"), CREATED_MS);
  }

  const canContinue =
    step === "tables" ||
    (step === "participants" && allNames.length > 0) ||
    (step === "name" && name.trim().length > 0);

  // "המשך" ו"חזרה" למטה הוסרו (מיותרים - יש חיצים בצידי המסך, לבקשת
  // הלקוחה). נשאר רק "שמירה והמשך" בסיכום, שהוא פעולה ולא דפדוף.
  // הכפתור מתחלף בהודעת ההצלחה באותו מקום - כך אי אפשר ללחוץ פעמיים.
  /**
   * חיצי הדפדוף בצדדים (לבקשת הלקוחה): חזרה מימין, המשך משמאל - כל אחד
   * ממורכז ברווח שלו. `inline`: בתוך שורת שדה ההזנה, ממורכזים לגובה השדה
   * ("שיהיה באמצע של השדה הזנה", 2026-11-12); אחרת - באמצע המסך.
   * stopPropagation: בצעד 1 כל הזירה לחיצה.
   */
  /*
    פס כחול שחוצה את השורה המרכזית של הצעד בכל דפדוף - בעובי השדה (בקשת
    הלקוחה 2026-11-14: "שיהיה יותר צר, בעובי של השדה של ההזנה"). יושב בדיוק
    בשורות שבהן יושבים החיצים (navArrows(true)), ובסיכום - על שם הקבוצה.
    לא בכניסה הראשונה - שם מגיעים דרך מעבר הרשת.
  */
  const sweep = !firstEntry ? (
    <div key={step} aria-hidden="true" className={cx("ed-sweep", sweepDir === "back" && "ed-sweep--back")} />
  ) : null;

  const navArrows = (inline: boolean) => (
    <>
      {inline && sweep}
      {stepIndex > 0 && (
        <button
          type="button"
          aria-label="חזרה"
          className={cx("ed-arrow ed-arrow--back", inline && "ed-arrow--inline")}
          onClick={(e) => {
            e.stopPropagation();
            setSweepDir("back");
            setStep(FORM_STEPS[stepIndex - 1]);
            playWhoosh(SOUND_STEP, true);
          }}
        >
          <EdArrow dir="back" />
        </button>
      )}
      {step !== "summary" && (
        <button
          type="button"
          aria-label="המשך"
          className={cx("ed-arrow ed-arrow--next", inline && "ed-arrow--inline")}
          disabled={!canContinue}
          onClick={(e) => {
            e.stopPropagation();
            goTo(FORM_STEPS[stepIndex + 1]);
          }}
        >
          <EdArrow dir="next" />
        </button>
      )}
    </>
  );

  const saveAction =
    celebration === "none" ? (
      <button type="button" className="bt-btn ed-btn" onClick={handleSave} disabled={saving}>
        <span className="bt-btn__label">
          {saving ? "שומר..." : "שמירה והמשך"}
          <EdArrow dir="diagonal" className="ed-btn__arrow" />
        </span>
      </button>
    ) : (
      <span role="status" className="ed-done">
        {t.created_line}
      </span>
    );

  /*
    ==========================================================================
    מסך מלא בשפת מסך הפתיחה ("עיתונאי", 2026-11-12)
    ==========================================================================
    המשך ישיר של "ברוכות הבאות": אותה רשת קווים, אותו בלוק כחול באותו מקום
    ואותם צבעים (כחול-לבן, נגיעות אדומות) - כך המעבר מרגיש כמו העמוד הבא
    באותו מגזין. בבלוק הכחול מד הצעדים, אנכי; בפס העליון "02 הזדהות" כמו
    כותרת רצה. העיצוב ב-styles/editorial.css (.ed-page).

    ההזדהות היא שכבה על **כל** המסך - מעל הסרגל העליון, מד ההתקדמות
    והטיימר (בקשת הלקוחה 2026-11-08: "מסך מלא מלא ממש"). הטיימר ממשיך לרוץ
    מאחור (StageRouter) ועדיין מעביר לבד בסוף הזמן.
    portal ל-body: שכבה fixed בתוך המעבר המונפש של השלב נמדדת לא נכון (באג 6).
  */
  return createPortal(
    <div className={cx("ed-page", curtainHeld && "is-held")}>
      <div className="ed-grid" aria-hidden="true" />
      <div className="ed-hline ed-hline--top" aria-hidden="true" />
      <div className="ed-hline ed-hline--bottom" aria-hidden="true" />

      {/* (התפזרות הלוגו לריבועים - ZoomIntro mode="shatter" - הוסרה מכאן עם
          המעבר לשפת "עיתונאי", 2026-11-12: הלוגו הישן, הצעיף הלבן והריבועים
          בנייבי אחר כיסו את הבלוק הכחול ולא תאמו את הצבעים החדשים. הכניסה
          עכשיו היא העלייה הרכה של הכותרת והתוכן, כמו במסך הפתיחה.) */}

      {/* כותרת רצה בפס העליון: מספר השלב, ומיקום הצעד */}
      <header className="ed-runner">
        <span className="ed-runner__id">
          <span className="ed-runner__num">02</span>
          הזדהות
        </span>
        <span aria-hidden="true">
          {stepIndex + 1} / {FORM_STEPS.length}
        </span>
      </header>

      {/* הבלוק הכחול - מד הצעדים. בלי קווי רשת על הכחול */}
      <section className="ed-panel" aria-label="שלבי ההזדהות">
        <ol className="ed-steps">
          {STEP_MARKS.map((mark, i) => (
            <li
              key={mark}
              aria-current={i === stepIndex ? "step" : undefined}
              className={cx("ed-steps__item", i < stepIndex && "is-done", i === stepIndex && "is-current")}
            >
              <span className="ed-steps__dot" aria-hidden="true" />
              <span className="ed-steps__mark">{mark}</span>
              <span className="ed-steps__label">{STEP_LABELS[i]}</span>
            </li>
          ))}
        </ol>
        <img src="/brand/fractal-logo-on-dark.png" alt="" className="ed-steps__logo" />
      </section>

      {/* "כלל הפרקטל" על כל המסך: המשפט נבנה מאותיות פ-ר-ק-ט-ל קטנות, ובסוף
          הבנייה עוברים לבד למסך הבא (לבקשת הלקוחה). */}
      {celebration === "fractal" && (
        <FractalFullscreen
          variant="editorial"
          title={t.fractal_title}
          text={t.fractal_text}
          onDone={onCelebrationEnd}
        />
      )}

      {/* פופ-אפ הטיפים לשם הקבוצה - נפתח בנגיעה ראשונה בשדה השם */}
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

      <main className="ed-frame">
        {/* "מי אתן?" בבולד, ושורת המעבר מתחתיה במשקל דק */}
        <div className="ed-rise" style={{ animationDelay: "0.2s" }}>
          {/* פס תחתון כתום מתחת ל"מי אתן?" (בקשת הלקוחה 2026-11-14) - באותו
              צבע כמו פס ההתקדמות בראש המסך */}
          <h1 className="ed-h1">
            <span className="ed-h1__line">מי אתן?</span>
          </h1>
          <p className="ed-lead">{t.shape_line}</p>
        </div>

        {/* זירת הצעד. בצעד I אין מה להזין - נגיעה בזירה עצמה מעבירה הלאה
            (לבקשת הלקוחה), כמו "המשך" */}
        <div
          key={step}
          className={cx("ed-stage", step === "tables" && "ed-stage--tap")}
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
          {/* בצעדים בלי שדה הזנה - החיצים באמצע המסך. בצעדים עם שדה - הם
              יושבים בשורת השדה עצמה (ראו navArrows למטה) */}
          {step === "summary" && navArrows(false)}

          {/* ---------- I. שולחנות עבודה ---------- */}
          {step === "tables" && (
            <div className="flex flex-1 flex-col justify-center">
              <Win delay={introOffset + 0.3} from="down">
                {/* החץ באותה שורה של הכותרת (2026-11-12) */}
                <div className="relative">
                  {navArrows(true)}
                  <p className="ed-statement">{t.tables_title}</p>
                </div>
                {t.tables_text && <p className="ed-lead">{t.tables_text}</p>}
                <span className="ed-hint">
                  <EdArrow dir="diagonal" />
                  נגעו במסך כדי להמשיך
                </span>
              </Win>
            </div>
          )}

          {/* ---------- II. פרטי המשתתפות ---------- */}
          {step === "participants" && (
            <div className="flex min-h-0 flex-1 flex-col gap-[3vh]">
              <Win from="right" delay={0.1} className="flex-none">
                <div className="flex items-center justify-between gap-6">
                  <h2 className="ed-h2">{t.participants_title}</h2>
                  {/* המונה "נדלק" בכל הוספה (key משתנה = האנימציה רצה מחדש) */}
                  <span
                    key={participants.length}
                    className="ed-count ed-rise"
                    aria-label={`${participants.length} מתוך ${MAX_PARTICIPANTS}`}
                  >
                    {participants.length}
                  </span>
                </div>
              </Win>

              {/* שורת השדה מחוץ ל-Win: הכניסה שלה היא הפס הכחול (ed-sweep)
                  שנפרש עליה וחושף אותה, ולא החלקה */}
              <div className="relative flex-none">
                {navArrows(true)}
                {isFull ? (
                  <p className="ed-note">הגעתן למספר המשתתפות המרבי בקבוצה ({MAX_PARTICIPANTS}).</p>
                ) : (
                  /* 2026-11-16: אותו שדה בדיוק, רק עם פס כתום בתחתיתו
                     (ed-line-field) */
                  <div className="ed-line-field">
                  <input
                    id="participant-draft"
                    ref={draftRef}
                    autoFocus
                    className="ed-input flex-none"
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
                  </div>
                )}
              </div>

              <Win from="left" delay={0.45} className="min-h-0" bodyClassName="min-h-0 !p-0">
                {participants.length > 0 ? (
                  <ul className="ed-chips">
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
                  <p className="ed-note">כל שם שתוסיפו יופיע כאן. נגיעה בשם מאפשרת לתקן אותו.</p>
                )}
              </Win>
            </div>
          )}

          {/* ---------- III. שם הקבוצה (הטיפים בפופ-אפ) ---------- */}
          {step === "name" && (
            <div className="flex flex-1 flex-col justify-center gap-[3vh]">
              <Win from="up" delay={0.1} bodyClassName="gap-[1.6vh] !p-0">
                <h2 className="ed-h2">{t.name_title}</h2>
                {t.name_bonus && <p className="ed-bonus">{t.name_bonus}</p>}
              </Win>
              {/* שורת השדה - הכניסה שלה היא הפס הכחול (ed-sweep), לא החלקה */}
              <div>
                <div className="relative flex w-full items-stretch gap-3">
                  {navArrows(true)}
                  {/* בלי autoFocus: הפופ-אפ קופץ בנגיעה בשדה, ומיקוד אוטומטי
                      היה מקפיץ אותו כבר בכניסה לצעד */}
                  <input
                    id="group-name"
                    className="ed-input"
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
                  <button type="button" className="ed-ghost" onClick={openTips}>
                    <Icon name="lightbulb" size={22} />
                    טיפים
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- ✓ סיכום ---------- */}
          {step === "summary" && (
            <div className="flex min-h-0 flex-1 flex-col gap-[2.6vh]">
              <Win from="up" delay={0.1} bodyClassName="gap-[0.8vh] !p-0">
                <span className="ed-kicker">{t.summary_title}</span>
                {/* שם הקבוצה מופיע אות-אחר-אות, באדום של הלוגו */}
                <div className="relative">
                {sweep}
                <p className="ed-name" aria-label={name.trim()}>
                  {Array.from(name.trim()).map((ch, i) => (
                    <span key={i} aria-hidden="true" style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
                      {ch}
                    </span>
                  ))}
                </p>
                </div>
              </Win>

              {allNames.length > 0 && (
                <Win from="right" delay={0.6} bodyClassName="!p-0">
                  <ul className="ed-tags">
                    {allNames.map((p, i) => (
                      <li
                        key={`${i}-${p}`}
                        className="ed-chip"
                        style={{ animationDelay: `${0.7 + i * 0.06}s` }}
                      >
                        <span className="ed-chip__main">
                          <span className="ed-num">{i + 1}</span>
                          {p}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Win>
              )}

              {/* המשפט שסוגר את ההזדהות, והכפתור מתחתיו */}
              <Win from="down" delay={1 + allNames.length * 0.06} className="mt-auto" bodyClassName="!p-0">
                <div className="flex items-end justify-between gap-8">
                  {/* שבירת שורה אחרי הפסיק הראשון (בקשת המפתחת 2026-11-16): "בניתן"
                      יורדת לשורה השנייה. בלי לשנות את הטקסט שמגיע מהמסד */}
                  <p className="ed-h2">
                    {(() => {
                      const cut = t.built_line.indexOf(", ");
                      if (cut < 0) return t.built_line;
                      return (
                        <>
                          {t.built_line.slice(0, cut + 1)}
                          <br />
                          {t.built_line.slice(cut + 2)}
                        </>
                      );
                    })()}
                  </p>
                  <div className="flex-none">{saveAction}</div>
                </div>
              </Win>
            </div>
          )}
        </div>
      </main>
    </div>,
    document.body,
  );
}

/**
 * חץ דק, בשפת מסך הפתיחה. ב-RTL "המשך" הוא שמאלה, "חזרה" ימינה, והאלכסוני
 * (↙) הוא החץ של "התחילו". vector-effect: הקו נשאר דק בכל גודל.
 */
function EdArrow({ dir, className }: { dir: "next" | "back" | "diagonal"; className?: string }) {
  const d =
    dir === "next"
      ? "M21 12 L3 12 M10 5 L3 12 L10 19"
      : dir === "back"
        ? "M3 12 L21 12 M14 5 L21 12 L14 19"
        : "M19 5 L5 19 M5 8 L5 19 L16 19";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
    <li className="ed-chip">
      <button type="button" onClick={onEdit} title="לתיקון השם" className="ed-chip__main">
        <span className="ed-num" aria-hidden="true">
          {index + 1}
        </span>
        <span className="ed-chip__name">{name}</span>
      </button>
      <button type="button" onClick={onRemove} aria-label={`הסרת ${name}`} className="ed-chip__x">
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}

/* ==========================================================================
   ב. מצב החדר
   ========================================================================== */

function RoomStatusNames({
  allGroups,
  myGroupId,
  content,
  onNext,
}: {
  allGroups: Group[];
  myGroupId: string;
  content?: Stage2Content;
  onNext: () => void;
}) {
  const t = { ...ROOM_DEFAULTS, ...(content?.room ?? {}) };
  const groupIds = allGroups.map((g) => g.id);
  const participants = useParticipants(groupIds);
  const allIdentified = allGroups.every((g) => g.name);

  /*
    סידור "קלפים" (בקשת המפתחת 2026-11-15, בהשראת chance-chany.lovable.app):
    הקבוצה של המסך הזה באמצע ובגדול, ושתי האחרות משני הצדדים, קטנות ומוטות
    קלות. הן "נשלפות" מאחורי הקלף האמצעי, כמו קלפים שנפתחים במניפה.
    ב-RTL הפריט הראשון ברשת הוא הימני - לכן הסדר: אחרת, שלנו, אחרת.
  */
  const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
  const mine = sorted.find((g) => g.id === myGroupId);
  const others = sorted.filter((g) => g.id !== myGroupId);
  const ordered = mine ? [others[0], mine, others[1]].filter((g): g is Group => Boolean(g)) : sorted;

  return (
    <StageShell
      stage={2}
      // התגית "מצב החדר" הוסרה (בקשת המפתחת 2026-11-15) - "איתנו במסע" גדל במקומה
      title="מי בחדר"
      subtitle={t.intro}
      background="ripple"
      width="wide"
      compactHeader
      // "תחלק את הרווחים בצורה שווה" + "תעלה את המשפט של איתנו במסע"
      // (בקשת הלקוחה, 2026-11-11): המרכוז נעשה בפנים עם justify-evenly, כך
      // ששלושת הרווחים שווים - כותרת→משפט, משפט→חלוניות, חלוניות→טקסט
      // תחתון. לפני כן (2026-11-08, "תצמצם את הרווח") הכול היה צמוד
      // לכותרת וכל השטח הפנוי נערם מתחת לחלוניות.
      center={false}
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
      {/* שלושה רווחים שווים: justify-evenly מפזר את השטח הפנוי לפני המשפט,
          בינו לחלוניות, ואחריהן. בלי שוליים משלהם, שלא ישברו את השוויון. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-evenly">
      {/* "איפה אנחנו במסע:" - כותרת לשלוש החלוניות */}
      {/* גדול יותר (בקשת המפתחת 2026-11-15) - זו הכותרת של הרגע הזה */}
      <h2 className="text-ink flex-none text-center text-5xl font-extrabold lg:text-6xl">{t.journey_title}</h2>

      {/* הגרסה הראשונה, לרוחב, עם "אתן" (חזרה לבקשת המפתחת 2026-11-15) */}
      <ul className="room-deck grid w-full flex-none grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_1.15fr_1fr]">
        {ordered.map((g, i) => {
            const groupParticipants = participants.filter((p) => p.group_id === g.id);
            const identified = Boolean(g.name);
            const isMine = g.id === myGroupId;
            // מאיפה הקלף "נשלף": הצדדיים יוצאים מאחורי הקלף האמצעי
            const side = isMine ? 0 : i === 0 ? 1 : -1;

            return (
              /*
                חלונית לפי התבנית שבאפיון: "קבוצה: ____ / משתתפות: ____".
                שתי שורות עם כותרת מודגשת והערך לצידה (בלי קווים מקווקווים -
                לבקשת הלקוחה). כל עוד הקבוצה לא הזדהתה, הערך ריק.
                החלוניות "קופצות" אחת אחרי השנייה.
              */
              <li
                key={g.id}
                className={cx(
                  "room-card glass glass-brick glass-raised relative flex flex-col gap-5 p-6 text-start",
                  isMine ? "is-mine" : "is-side",
                )}
                style={
                  {
                    "--dx": `${side * -105}%`,
                    "--rot": `${side * 3}deg`,
                  } as React.CSSProperties
                }
              >
                {/* תג "אתן" על הקלף של המסך הזה */}
                {isMine && <span className="room-card__you">אתן</span>}
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
      </div>
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
  myGroupId,
  content,
  onAdvance,
}: {
  allGroups: Group[];
  myGroupId: string;
  content?: Stage2Content;
  onAdvance: () => void;
}) {
  const [showingVideo, setShowingVideo] = useState(false);

  if (showingVideo) {
    return <DilemmaVideo content={content} onAdvance={onAdvance} />;
  }
  return (
    <RoomStatusNames
      allGroups={allGroups}
      myGroupId={myGroupId}
      content={content}
      onNext={() => setShowingVideo(true)}
    />
  );
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
  return <RoomStatus allGroups={allGroups} myGroupId={myGroup.id} content={content} onAdvance={onAdvance} />;
}

export default Stage2Identification;
