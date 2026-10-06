import { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";
import AutoPlayVideo from "../AutoPlayVideo";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import { GlassButton } from "../ui/Glass";
import { InlineNotice } from "../ui/Feedback";
import { useToast } from "../ui/Toast";
import { cx } from "../../lib/cx";

const MAX_PARTICIPANTS = 15;

interface Stage2Content {
  /** כתובת סרטון הדילמה. נקראת מהמסד ולא כתובה בקוד. */
  dilemma_video_url?: string;
  dilemma_title?: string;
  dilemma_text?: string;
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
 * הזנת המשתתפות: שדה אחד + תגים
 * ----------------------------------------------------------------------------
 * הגרסה הקודמת הייתה רשימה של שדות, שורה לכל משתתפת. על מסך הסדנה זה
 * לא עבד: כל משתתפת דרשה לחיצה על "הוסיפי", ואז לחיצה על השדה החדש, והרשימה
 * גללה בתוך חלון צר שבו רואים שורה וחצי.
 *
 * עכשיו יש **שדה הקלדה אחד** שנשאר בפוקוס: מקלידים שם, Enter (או "הוסיפי"),
 * והשם עובר לתג למטה - והמקלדת הווירטואלית לא נסגרת, כך שאפשר להקליד את
 * כל הקבוצה ברצף. התגים נעטפים לכמה שורות, ו-15 שמות נכנסים בלי גלילה.
 * נגיעה בשם בתג מחזירה אותו לשדה לתיקון; × מסיר אותו.
 *
 * מה שנשאר מהגרסה הקודמת: מונה מפורש (3/15), אישור שמירה (toast), ומחיקה
 * במצב המקומי בלבד לפני השמירה. שם שהוקלד ולא נוסף נשמר גם הוא - שלא
 * יאבד שם רק כי שכחו ללחוץ Enter.
 */
function IdentificationForm({ myGroup }: { myGroup: Group }) {
  const [name, setName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const isFull = participants.length >= MAX_PARTICIPANTS;
  const canAdd = draft.trim().length > 0 && !isFull;
  const canSave = name.trim().length > 0 && !saving;

  function addParticipant() {
    if (!canAdd) return;
    setParticipants((current) => [...current, draft.trim()]);
    setDraft("");
    // הפוקוס נשאר בשדה - המקלדת לא נסגרת בין שם לשם
    draftRef.current?.focus();
  }

  function removeParticipant(index: number) {
    setParticipants((current) => current.filter((_, i) => i !== index));
  }

  /** מחזיר שם מהתג לשדה לתיקון. שם שכבר היה בשדה לא הולך לאיבוד. */
  function editParticipant(index: number) {
    const pending = draft.trim();
    setParticipants((current) => {
      const next = current.filter((_, i) => i !== index);
      return pending ? [...next, pending] : next;
    });
    setDraft(participants[index]);
    draftRef.current?.focus();
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    await supabase.from("groups").update({ name: name.trim() }).eq("id", myGroup.id).then();

    const names = [...participants, draft.trim()].filter((p) => p.length > 0);
    const rows = names.slice(0, MAX_PARTICIPANTS).map((p) => ({ group_id: myGroup.id, name: p }));
    if (rows.length > 0) {
      await supabase.from("participants").insert(rows).then();
    }
    setSaving(false);
    toast(`נרשמתן כ"${name.trim()}"`, { tone: "ok", icon: "users" });
  }

  return (
    <StageShell
      stage={2}
      kicker="הזדהות"
      icon="users"
      title="מי אתן?"
      subtitle="בחרו שם לקבוצה והוסיפו את שמות המשתתפות. השמות יופיעו אצל כל הקבוצות בחדר."
      background="ripple"
      width="wide"
      actions={
        <GlassButton
          variant="primary"
          size="lg"
          icon="save"
          onClick={handleSave}
          disabled={!canSave}
          loading={saving}
        >
          {saving ? "שומר..." : "שמירה והמשך"}
        </GlassButton>
      }
    >
      {/*
        שתי עמודות במסך רחב: בימין מקלידים (שם הקבוצה + שדה ההוספה), בשמאל
        רואים את כל המשתתפות. בעמודה אחת התגים קיבלו שורה אחת בתחתית
        הכרטיס ונחתכו; כאן יש להם את כל גובה הכרטיס, ו-15 שמות נכנסים.
        הכרטיס מתכווץ לגובה הפנוי (`min-h-0`) - המסגרת תמיד שלמה.
      */}
      <div className="glass glass-brick glass-raised grid min-h-0 w-full gap-5 rounded-2xl p-5 sm:p-6 lg:grid-cols-[2fr_3fr] lg:gap-8">
        {/* --- עמודת ההקלדה --- */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="group-name" className="text-ink-2 flex items-center gap-2 px-2 text-sm font-bold">
              <Icon name="star" size={15} className="text-accent-soft" />
              שם הקבוצה
            </label>
            <input
              id="group-name"
              className="glass-input !min-h-[3.75rem] !text-xl"
              placeholder="שם הקבוצה"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // Enter בשם הקבוצה מעביר ישר להקלדת המשתתפות
                if (e.key === "Enter") {
                  e.preventDefault();
                  draftRef.current?.focus();
                }
              }}
              enterKeyHint="next"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="participant-draft" className="text-ink-2 flex items-center gap-2 px-2 text-sm font-bold">
              <Icon name="userPlus" size={15} className="text-accent-soft" />
              הוספת משתתפת
              <span className="text-ink-3 font-semibold">- הקלדת שם ו-Enter</span>
            </label>
            {isFull ? (
              <InlineNotice tone="info">
                הגעתן למספר המשתתפות המרבי בקבוצה ({MAX_PARTICIPANTS}).
              </InlineNotice>
            ) : (
              <input
                  id="participant-draft"
                  ref={draftRef}
                  className="glass-input !min-h-[3.75rem] !text-xl"
                  placeholder="שם המשתתפת"
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
          </div>
        </div>

        {/* --- עמודת המשתתפות --- */}
        <div className="flex min-h-0 flex-col gap-2 lg:border-s lg:border-edge-dim lg:ps-8">
          <div className="flex flex-none items-center justify-between px-2">
            <span className="text-ink-2 flex items-center gap-2 text-sm font-bold">
              <Icon name="users" size={15} className="text-accent-soft" />
              המשתתפות
            </span>
            <span className="text-ink-3 text-xs font-bold tabular-nums">
              {participants.length} / {MAX_PARTICIPANTS}
            </span>
          </div>

          {/* התגים. נעטפים לשורות; גוללים בתוך העמודה רק אם באמת חסר מקום. */}
          {participants.length > 0 ? (
            <ul className="glass-scroll -m-2 grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] content-start gap-x-2 gap-y-1.5 overflow-y-auto p-2">
              {participants.map((p, i) => (
                <li
                  key={`${i}-${p}`}
                  className="glass glass-raised glass-pill flex min-w-0 items-center justify-between gap-0.5 py-0.5 ps-1 pe-0.5"
                  style={{ animation: "glass-in var(--ds-dur) var(--ds-ease) both" }}
                >
                  <button
                    type="button"
                    onClick={() => editParticipant(i)}
                    title="לתיקון השם"
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full"
                  >
                    <span
                      aria-hidden="true"
                      className={`bubble bubble--${(i % 5) + 1} flex h-7 w-7 flex-none items-center justify-center text-[11px] font-extrabold`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-ink truncate text-base font-bold">{p}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(i)}
                    aria-label={`הסרת ${p}`}
                    className="text-ink-3 hover:text-ink flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3 flex flex-1 items-center justify-center px-2 text-center text-base">
              כל שם שתוסיפו יופיע כאן.
              <br />
              נגיעה בשם מאפשרת לתקן אותו.
            </p>
          )}
        </div>
      </div>
    </StageShell>
  );
}

/* ==========================================================================
   ב. מצב החדר
   ========================================================================== */

function RoomStatusNames({
  allGroups,
  onNext,
}: {
  allGroups: Group[];
  onNext: () => void;
}) {
  const groupIds = allGroups.map((g) => g.id);
  const participants = useParticipants(groupIds);
  const allIdentified = allGroups.every((g) => g.name);
  const identifiedCount = allGroups.filter((g) => g.name).length;

  return (
    <StageShell
      stage={2}
      kicker="מצב החדר"
      icon="users"
      title="מי בחדר"
      subtitle={
        allIdentified
          ? "כל הקבוצות הזדהו. אפשר להתחיל."
          : `${identifiedCount} מתוך ${allGroups.length} קבוצות הזדהו. ממתינים לשאר.`
      }
      background="ripple"
      width="wide"
      actions={
        allIdentified ? (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onNext}>
            לצפייה בדילמה
          </GlassButton>
        ) : (
          <span className="glass glass-pill text-ink-2 gap-2.5 px-6 py-3.5 text-base font-bold">
            <Icon name="hourglass" size={18} className="text-accent-soft" />
            ממתינים לשאר הקבוצות
          </span>
        )
      }
    >
      <ul className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g, i) => {
            const groupParticipants = participants.filter((p) => p.group_id === g.id);
            const identified = Boolean(g.name);

            return (
              <li
                key={g.id}
                className="glass glass-brick glass-raised flex flex-col gap-4 rounded-2xl p-6"
                style={{
                  animation: `glass-in var(--ds-dur-slow) ${i * 110}ms var(--ds-ease) both`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-16 w-16 flex-none items-center justify-center",
                      identified
                        ? `bubble bubble--${((g.screen_number - 1) % 5) + 1}`
                        : "bubble bubble-hollow text-ink-3",
                    )}
                  >
                    {identified ? <Icon name="check" size={24} /> : g.screen_number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink-3 text-[11px] font-bold">מסך {g.screen_number}</p>
                    <p
                      className={cx(
                        "truncate text-xl font-extrabold",
                        identified ? "text-ink" : "text-ink-3 italic",
                      )}
                    >
                      {g.name ?? "טרם הזדהו"}
                    </p>
                  </div>
                </div>

                {groupParticipants.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {groupParticipants.map((p) => (
                      <li
                        key={p.id}
                        className="glass glass-dim glass-chip text-ink-2 !text-[13px]"
                      >
                        {p.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-3 text-sm italic">טרם הוזנו משתתפות</p>
                )}
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
      {content?.dilemma_video_url ? (
        /*
          נגן בגודל נורמלי, לא פרוס על כל המסך.
          ניסיון קודם נתן לו את כל הרוחב ואת כל הגובה שנשאר, והתוצאה
          הייתה סרטון מרוח לרוחב עם פסים שחורים ענקיים מעל ומתחת -
          כי יחס הגובה-רוחב של הסרטון לא משתנה רק כי המסגרת גדלה.
          כאן המסגרת **נגזרת מהסרטון**: יחס 16:9 קבוע, ברוחב סביר,
          וממורכזת.
        */
        /*
          הסרטון ממלא את **כל** הגובה הפנוי (בלי תקרה של 58% - הלקוחה
          ביקשה סרטון גדול יותר), והמסגרת נגזרת ממנו ולא מהרוחב.

          כשהגודל נקבע לפי הרוחב (`w-full max-w-4xl` + 16:9), הגובה
          שנגזר ממנו היה גדול מהמקום שנשאר בין הכותרת לכפתור, והסרטון
          נחתך בתחתית. כאן העוטף ממלא את כל הגובה (`h-full`), המסגרת
          מקבלת את הגובה הזה, והרוחב נגזר ממנו לפי 16:9 - עד רוחב
          המסך. אם אין 58% פנויים, הסרטון קטן מעט - אבל אף פעם לא נחתך.
        */
        /*
          המסגרת בדיוק בגודל הסרטון: רוחב = הקטן מבין רוחב האזור, הרוחב
          שבין הפאנלים שבפינות, וגובה האזור כפול 16/9 (100cqh - העוטף הוא
          container). כך היחס 16:9 נשמר תמיד, ואין רצועה ריקה מתחת לסרטון.
          דפדפן ישן בלי cqh מתעלם מה-min ונשאר עם w-full + max-h-full.
        */
        <div className="flex h-full min-h-0 w-full items-center justify-center [container-type:size]">
          <div
            className="glass glass-brick glass-raised aspect-video max-h-full w-full overflow-hidden rounded-2xl p-2"
            style={{ width: "min(100cqw, max(20rem, calc(100vw - 46rem)), calc((100cqh - 4px) * 16 / 9))" }}
          >
            <AutoPlayVideo
              src={content.dilemma_video_url}
              fill
              className="h-full w-full rounded-xl object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="glass glass-brick mx-auto flex aspect-video h-full max-h-full max-w-full items-center justify-center rounded-2xl">
          <div className="text-ink-3 flex flex-col items-center gap-3">
            <span className="glass glass-dim glass-icon-btn glass-icon-btn-lg">
              <Icon name="film" size={30} />
            </span>
            <span className="text-sm font-bold">כאן יופיע סרטון הדילמה</span>
          </div>
        </div>
      )}
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
  return <RoomStatusNames allGroups={allGroups} onNext={() => setShowingVideo(true)} />;
}

function Stage2Identification({ myGroup, allGroups, content, onAdvance }: Props) {
  if (!myGroup.name) {
    return <IdentificationForm myGroup={myGroup} />;
  }
  return <RoomStatus allGroups={allGroups} content={content} onAdvance={onAdvance} />;
}

export default Stage2Identification;
