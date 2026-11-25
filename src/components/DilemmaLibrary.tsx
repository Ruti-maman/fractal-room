import { useEffect, useState } from "react";
import { useDilemmaLibrary } from "../hooks/useDilemmas";
import { getAdminWorkshop, setWorkshopDilemma } from "../lib/workshopActions";
import { dilemmaVideoSrc } from "../lib/dilemmaVideo";
import { GlassButton } from "./ui/Glass";
import { InlineNotice } from "./ui/Feedback";
import { useToast } from "./ui/Toast";
import GlassModal from "./ui/GlassModal";
import { addDilemma, deleteDilemma } from "../lib/libraryActions";

/**
 * ספריית הדילמות (2026-11-19, דרישת הלקוחה):
 *   "ספריית דילמות, מסך ראשוני שמרוכזים בו כל הדילמות, ויש אפשרות לבחור את
 *    הדילמה שתוביל את הסדנה."
 *
 * כל הדילמות של התוכנית ככרטיסים: הסרטון (אפשר לצפות בו ישר מהכרטיס),
 * הכותרת והמשפט המסכם. "בחירה" שומרת את הדילמה על ההפעלה הפעילה
 * (workshops.dilemma_id) - והמסכים בחדר מתעדכנים לבד. "סדנה חדשה" ממשיכה
 * עם הדילמה שנבחרה (startNewWorkshop).
 */
function DilemmaLibrary() {
  const toast = useToast();
  const [info, setInfo] = useState<{ workshopId: string | null; programId: string | null; dilemmaId: string | null }>(
    { workshopId: null, programId: null, dilemmaId: null },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const { dilemmas, loading, reload } = useDilemmaLibrary(info.programId ?? undefined);

  // הוספה ומחיקה (2026-11-25, דרישת הלקוחה)
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const err = await deleteDilemma(toDelete.id);
    setDeleting(false);
    if (err) {
      toast(err, { tone: "danger" });
      return;
    }
    if (toDelete.id === info.dilemmaId) setInfo((s) => ({ ...s, dilemmaId: null }));
    setToDelete(null);
    await reload();
    toast("הדילמה נמחקה.", { tone: "ok" });
  }

  useEffect(() => {
    getAdminWorkshop().then((r) => {
      if (r.error) setError(r.error);
      setInfo({ workshopId: r.workshopId, programId: r.programId, dilemmaId: r.dilemmaId });
    });
  }, []);

  async function choose(id: string) {
    if (!info.workshopId) {
      toast("אין סדנה פעילה. פתחו סדנה חדשה ואז בחרו דילמה.", { tone: "danger" });
      return;
    }
    setSaving(id);
    const err = await setWorkshopDilemma(info.workshopId, id);
    setSaving(null);
    if (err) {
      toast(`הבחירה לא נשמרה: ${err}`, { tone: "danger" });
      return;
    }
    setInfo((s) => ({ ...s, dilemmaId: id }));
    toast("הדילמה נבחרה. המסכים בחדר מתעדכנים.", { tone: "ok" });
  }

  const chosen = dilemmas.find((d) => d.id === info.dilemmaId);

  return (
    <section className="dl-library" aria-labelledby="dl-title">
      <header className="dl-head">
        <h2 id="dl-title" className="dl-title">
          <span className="dl-title__sq" aria-hidden="true" />
          ספריית הדילמות
        </h2>
        <p className="dl-sub">
          {chosen ? (
            <>
              הדילמה שמובילה את הסדנה: <b>{chosen.title}</b>
            </>
          ) : (
            "בחרו את הדילמה שתוביל את הסדנה."
          )}
        </p>
      </header>

      {error && (
        <InlineNotice tone="danger" title="לא הצלחנו לטעון את הסדנה">
          {error}
        </InlineNotice>
      )}

      {!loading && dilemmas.length === 0 && !error && (
        <InlineNotice tone="warn" title="הספרייה ריקה">
          עוד אין דילמות בתוכנית הזו (supabase/add_dilemmas.sql).
        </InlineNotice>
      )}

      <ol className="dl-grid">
        {dilemmas.map((d, i) => {
          const isChosen = d.id === info.dilemmaId;
          return (
            <li key={d.id} className={`dl-card${isChosen ? " is-chosen" : ""}`}>
              <div className="dl-card__media">
                {d.video_url ? (
                  // #t=6 - פריים מתוך הסרטון כתמונת כרטיס, לפני שמנגנים
                  <video src={`${dilemmaVideoSrc(d.video_url)}#t=6`} controls preload="metadata" playsInline />
                ) : (
                  <span className="dl-card__novideo">אין סרטון</span>
                )}
              </div>
              <div className="dl-card__body">
                <span className="dl-card__num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="dl-card__title">{d.title}</h3>
                {d.summary && <p className="dl-card__summary">{d.summary}</p>}
              </div>
              <div className="dl-card__foot">
                <button
                  type="button"
                  className="dl-card__delete"
                  onClick={() => setToDelete({ id: d.id, title: d.title })}
                  aria-label={`מחיקת ${d.title}`}
                >
                  מחיקה
                </button>
                {isChosen ? (
                  <span className="dl-card__chosen">✓ הדילמה של הסדנה</span>
                ) : (
                  <GlassButton
                    variant="primary"
                    onClick={() => choose(d.id)}
                    loading={saving === d.id}
                    disabled={saving !== null}
                  >
                    בחירה
                  </GlassButton>
                )}
              </div>
            </li>
          );
        })}
        <li className="dl-card dl-card--add">
          {adding && info.programId ? (
            <AddDilemmaForm
              programId={info.programId}
              onCancel={() => setAdding(false)}
              onSaved={async () => {
                setAdding(false);
                await reload();
                toast("הדילמה נוספה לספרייה.", { tone: "ok" });
              }}
            />
          ) : (
            <button type="button" className="dl-add" onClick={() => setAdding(true)} disabled={!info.programId}>
              <span className="dl-add__plus" aria-hidden="true">+</span>
              הוספת דילמה
            </button>
          )}
        </li>
      </ol>

      <GlassModal
        open={toDelete !== null}
        tone="danger"
        title="למחוק את הדילמה?"
        description={toDelete ? `"${toDelete.title}" תימחק מהספרייה. אם היא הדילמה של הסדנה, הסדנה תחזור לתוכן הרגיל של השלבים.` : undefined}
        confirmLabel="מחיקה"
        confirmLoading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

/** טופס דילמה חדשה: כותרת, משפט לשמש (שלב 3), תיאור לסימון (שלב 4), סרטון (שלב 2) */
function AddDilemmaForm({
  programId,
  onCancel,
  onSaved,
}: {
  programId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [profileText, setProfileText] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("חסרה כותרת לדילמה.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await addDilemma({ programId, title, summary, profileText, video });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  return (
    <form
      className="lib-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h3 className="lib-form__title">דילמה חדשה</h3>
      <label className="lib-field">
        <span>כותרת</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="lib-field">
        <span>משפט קצר (במרכז השמש, שלב 3)</span>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <label className="lib-field">
        <span>תיאור הדילמה (מסמנים עליו חוזקות וחסמים, שלב 4)</span>
        <textarea rows={5} value={profileText} onChange={(e) => setProfileText(e.target.value)} />
      </label>
      <label className="lib-field">
        <span>סרטון הדילמה (שלב 2)</span>
        <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="lib-form__error">{error}</p>}
      <div className="lib-form__actions">
        <GlassButton variant="primary" type="submit" loading={saving} disabled={saving}>
          שמירה
        </GlassButton>
        <GlassButton variant="ghost" type="button" onClick={onCancel} disabled={saving}>
          ביטול
        </GlassButton>
      </div>
    </form>
  );
}

export default DilemmaLibrary;
