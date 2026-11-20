import { useEffect, useState } from "react";
import { useDilemmaLibrary } from "../hooks/useDilemmas";
import { getAdminWorkshop, setWorkshopDilemma } from "../lib/workshopActions";
import { dilemmaVideoSrc } from "../lib/dilemmaVideo";
import { GlassButton } from "./ui/Glass";
import { InlineNotice } from "./ui/Feedback";
import { useToast } from "./ui/Toast";

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
  const { dilemmas, loading } = useDilemmaLibrary(info.programId ?? undefined);

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
      </ol>
    </section>
  );
}

export default DilemmaLibrary;
