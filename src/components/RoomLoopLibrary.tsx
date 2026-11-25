import { useCallback, useEffect, useState } from "react";
import { addRoomLoop, deleteRoomLoop, fetchRoomLoops } from "../lib/libraryActions";
import { ROOM_LOOP_COLORS, type RoomLoopColor, type RoomLoopKind, type RoomLoopRow } from "../types/roomLoop";
import { GlassButton } from "./ui/Glass";
import GlassModal from "./ui/GlassModal";
import { useToast } from "./ui/Toast";

/**
 * לופים נוספים למסך הגדול (2026-11-25, דרישת הלקוחה): "כפתור הוספת לופ עם
 * אפשרות ללופ ידני או סרטון", ו"בחירת צבע כתום, כחול או לבן".
 * הלופים נשמרים בטבלת room_loops ומופיעים בדף הלופים (מסך העשרה וידע), אחרי
 * הלופים המקוריים. לופ ידני = שקפים של טקסט (שורה לכל שקף), עוברים בנגיעה.
 */
function RoomLoopLibrary() {
  const toast = useToast();
  const [loops, setLoops] = useState<RoomLoopRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<RoomLoopRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => setLoops(await fetchRoomLoops()), []);
  useEffect(() => {
    reload();
  }, [reload]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const err = await deleteRoomLoop(toDelete.id);
    setDeleting(false);
    if (err) {
      toast(err, { tone: "danger" });
      return;
    }
    setToDelete(null);
    await reload();
    toast("הלופ נמחק.", { tone: "ok" });
  }

  return (
    <section className="dl-library" aria-labelledby="rl-lib-title">
      <header className="dl-head">
        <h2 id="rl-lib-title" className="dl-title">
          <span className="dl-title__sq" aria-hidden="true" />
          לופים נוספים למסך הגדול
        </h2>
        <p className="dl-sub">לופים שתוסיפו כאן יופיעו בדף הלופים (מסך העשרה וידע), אחרי הלופים של הסדנה.</p>
      </header>

      <ol className="dl-grid">
        {loops.map((l) => (
          <li key={l.id} className="dl-card">
            <div className={`ll-swatch ll-swatch--${l.color}`}>
              <span className="ll-swatch__kind">{l.kind === "video" ? "סרטון" : `${l.slides.length} שקפים`}</span>
              <span className="ll-swatch__title">{l.title}</span>
            </div>
            <div className="dl-card__foot">
              <button type="button" className="dl-card__delete" onClick={() => setToDelete(l)} aria-label={`מחיקת ${l.title}`}>
                מחיקה
              </button>
            </div>
          </li>
        ))}
        <li className="dl-card dl-card--add">
          {adding ? (
            <AddLoopForm
              onCancel={() => setAdding(false)}
              onSaved={async () => {
                setAdding(false);
                await reload();
                toast("הלופ נוסף. הוא מופיע עכשיו בדף הלופים.", { tone: "ok" });
              }}
            />
          ) : (
            <button type="button" className="dl-add" onClick={() => setAdding(true)}>
              <span className="dl-add__plus" aria-hidden="true">+</span>
              הוספת לופ
            </button>
          )}
        </li>
      </ol>

      <GlassModal
        open={toDelete !== null}
        tone="danger"
        title="למחוק את הלופ?"
        description={toDelete ? `"${toDelete.title}" יימחק מדף הלופים.` : undefined}
        confirmLabel="מחיקה"
        confirmLoading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

function AddLoopForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<RoomLoopKind>("manual");
  const [color, setColor] = useState<RoomLoopColor>("blue");
  const [slidesText, setSlidesText] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("חסרה כותרת ללופ.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await addRoomLoop({ title, kind, color, slides: slidesText.split("\n"), video });
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
      <h3 className="lib-form__title">לופ חדש</h3>
      <label className="lib-field">
        <span>כותרת</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: פרקטל בכיתה" required />
      </label>

      <fieldset className="lib-choice">
        <legend>סוג הלופ</legend>
        <label>
          <input type="radio" name="kind" checked={kind === "manual"} onChange={() => setKind("manual")} />
          ידני - שקפים של טקסט
        </label>
        <label>
          <input type="radio" name="kind" checked={kind === "video"} onChange={() => setKind("video")} />
          סרטון
        </label>
      </fieldset>

      <fieldset className="lib-choice">
        <legend>צבע</legend>
        {ROOM_LOOP_COLORS.map((c) => (
          <label key={c.value} className={`lib-color lib-color--${c.value}${color === c.value ? " is-on" : ""}`}>
            <input type="radio" name="color" checked={color === c.value} onChange={() => setColor(c.value)} />
            <span className="lib-color__chip" aria-hidden="true" />
            {c.label}
          </label>
        ))}
      </fieldset>

      {kind === "manual" ? (
        <label className="lib-field">
          <span>השקפים - כל שורה היא שקף</span>
          <textarea
            rows={6}
            value={slidesText}
            onChange={(e) => setSlidesText(e.target.value)}
            placeholder={"שקף ראשון\nשקף שני\nשקף שלישי"}
          />
        </label>
      ) : (
        <label className="lib-field">
          <span>קובץ הסרטון</span>
          <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </label>
      )}

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

export default RoomLoopLibrary;
