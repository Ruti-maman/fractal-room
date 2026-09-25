import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";
import AutoPlayVideo from "../AutoPlayVideo";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import { GlassButton, GlassIconButton } from "../ui/Glass";
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
 * מה השתנה כאן מעבר לעיצוב
 * ----------------------------------------------------------------------------
 * 1. **אפשר למחוק שורת משתתפת.** קודם אפשר היה רק להוסיף, ושורה שנוספה
 *    בטעות נשארה על המסך עד סוף הסדנה. המחיקה היא במצב המקומי בלבד, לפני
 *    השמירה - לא נוגעת בשום דבר שכבר נשמר.
 * 2. **מונה מפורש** (3/15) במקום שהכפתור פשוט ייעלם בלי הסבר כשמגיעים
 *    לגבול.
 * 3. **אישור שמירה.** קודם לחיצה על "שמרי" לא נתנה שום משוב, וקבוצה
 *    שלחצה פעמיים יצרה משתתפות כפולות.
 */
function IdentificationForm({ myGroup }: { myGroup: Group }) {
  const [name, setName] = useState("");
  const [participantNames, setParticipantNames] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const filledParticipants = participantNames.filter((p) => p.trim().length > 0).length;
  const canSave = name.trim().length > 0 && !saving;

  function updateParticipant(index: number, value: string) {
    setParticipantNames((current) =>
      current.map((p, i) => (i === index ? value : p)),
    );
  }

  function addParticipant() {
    if (participantNames.length >= MAX_PARTICIPANTS) return;
    setParticipantNames((current) => [...current, ""]);
  }

  function removeParticipant(index: number) {
    setParticipantNames((current) =>
      current.length === 1 ? [""] : current.filter((_, i) => i !== index),
    );
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    await supabase.from("groups").update({ name: name.trim() }).eq("id", myGroup.id).then();

    const rows = participantNames
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => ({ group_id: myGroup.id, name: p }));
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
      botanical="lavender"
      width="narrow"
      actions={
        <GlassButton
          variant="primary"
          size="lg"
          icon="save"
          onClick={handleSave}
          disabled={!canSave}
          loading={saving}
        >
          {saving ? "שומרת..." : "שמרי והמשיכי"}
        </GlassButton>
      }
    >
      <div className="glass glass-brick flex w-full flex-col gap-6 rounded-2xl p-6 sm:p-8">
        {/* שם הקבוצה - השדה החשוב, ולכן גדול ונפרד משאר הטופס */}
        <div className="flex flex-col gap-2">
          <label htmlFor="group-name" className="text-ink-2 flex items-center gap-2 px-2 text-sm font-bold">
            <Icon name="star" size={15} className="text-accent-soft" />
            שם הקבוצה
          </label>
          <input
            id="group-name"
            className="glass-input !min-h-[4.5rem] text-center !text-2xl"
            placeholder="איך נקרא לכן?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <hr className="border-edge-dim border-t" />

        {/* המשתתפות */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-ink-2 flex items-center gap-2 text-sm font-bold">
              <Icon name="users" size={15} className="text-accent-soft" />
              המשתתפות
            </span>
            <span className="text-ink-3 text-xs font-bold tabular-nums">
              {filledParticipants} / {MAX_PARTICIPANTS}
            </span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {participantNames.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cx(
                    "glass flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-extrabold",
                    p.trim() ? "glass-active" : "text-ink-3 glass-dim",
                  )}
                >
                  {i + 1}
                </span>
                <input
                  className="glass-input !min-h-[3.25rem] !text-lg"
                  placeholder={`שם משתתפת ${i + 1}`}
                  aria-label={`שם משתתפת ${i + 1}`}
                  value={p}
                  onChange={(e) => updateParticipant(i, e.target.value)}
                  autoComplete="off"
                />
                <GlassIconButton
                  icon="close"
                  label={`הסרת משתתפת ${i + 1}`}
                  size="sm"
                  onClick={() => removeParticipant(i)}
                  className="!h-11 !w-11"
                />
              </li>
            ))}
          </ul>

          {participantNames.length < MAX_PARTICIPANTS ? (
            <GlassButton icon="userPlus" onClick={addParticipant} block className="!min-h-[3.5rem]">
              הוסיפי משתתפת
            </GlassButton>
          ) : (
            <InlineNotice tone="info">
              הגעתן למספר המשתתפות המרבי בקבוצה ({MAX_PARTICIPANTS}).
            </InlineNotice>
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
          : `${identifiedCount} מתוך ${allGroups.length} קבוצות הזדהו. ממתינות לשאר.`
      }
      botanical="fern"
      width="wide"
      actions={
        allIdentified ? (
          <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onNext}>
            לצפייה בדילמה
          </GlassButton>
        ) : (
          <span className="glass glass-pill text-ink-2 gap-2.5 px-6 py-3.5 text-base font-bold">
            <Icon name="hourglass" size={18} className="text-accent-soft" />
            ממתינות שכל הקבוצות יזדהו
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
                className="glass glass-brick flex flex-col gap-4 rounded-2xl p-6"
                style={{
                  animation: `glass-in var(--ds-dur-slow) ${i * 110}ms var(--ds-ease) both`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "glass glass-icon-btn flex-none",
                      identified ? "glass-active" : "text-ink-3 glass-dim",
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

function DilemmaVideo({ content }: { content?: Stage2Content }) {
  return (
    <StageShell
      stage={2}
      kicker="הדילמה"
      icon="film"
      title={content?.dilemma_title ?? "הדילמה הפדגוגית"}
      subtitle={
        content?.dilemma_text ?? "הצגת הדילמה המרכזית שאיתה נתמודד לאורך הסדנה."
      }
      botanical={false}
      width="wide"
    >
      {content?.dilemma_video_url ? (
        <div className="glass glass-brick w-full overflow-hidden rounded-2xl p-3">
          <AutoPlayVideo
            src={content.dilemma_video_url}
            className="max-h-[56vh] w-full rounded-xl"
          />
        </div>
      ) : (
        <div className="glass glass-brick flex min-h-[20rem] w-full items-center justify-center rounded-2xl">
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
}: {
  allGroups: Group[];
  content?: Stage2Content;
}) {
  const [showingVideo, setShowingVideo] = useState(false);

  if (showingVideo) {
    return <DilemmaVideo content={content} />;
  }
  return <RoomStatusNames allGroups={allGroups} onNext={() => setShowingVideo(true)} />;
}

/**
 * במסך סרטון הדילמה אין כפתור "הבא" בכוונה - הטיימר הוא שמעביר לשלב
 * הבא (תשובת הלקוחה, סעיף 10 ב-CLAUDE.md). לכן `onAdvance` מגיע מהראוטר
 * אבל לא נצרך כאן.
 */
function Stage2Identification({ myGroup, allGroups, content }: Props) {
  if (!myGroup.name) {
    return <IdentificationForm myGroup={myGroup} />;
  }
  return <RoomStatus allGroups={allGroups} content={content} />;
}

export default Stage2Identification;
