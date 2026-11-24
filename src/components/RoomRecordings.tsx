import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "../types/group";
import { useMedia } from "../hooks/useMedia";
import { segmentsToVtt, useClipTranscripts } from "../hooks/useClipTranscripts";
import { listProjectClips, projectClipUrl } from "../lib/projectClips";

/**
 * המסך הגדול, שלב 7 (2026-11-20). מהאפיון של הלקוחה, סעיף 25:
 *   "עדכון של כל ההסרטות על המסך הגדול ואפשרות צפייה"
 * (החלק השני שם - "הבניית הפיצ'ר החדש להשגת ניצחון" - "נצטרך לדבר", ולא נבנה.)
 *
 * למטה - שלוש הקבוצות, ולכל אחת מצב ההקלטה שלה, שמתעדכן בזמן אמת. במרכז -
 * ההקלטות שכבר הועלו מתנגנות בזו אחר זו, בגדול. המסך הגדול בלי קול (האפיון
 * הכללי), ולכן הסרטון מושתק ומוצגות הכתוביות שה-AI כבר מתמלל לכל הקלטה.
 *
 * מקור הסרטון: קובץ בתוך הפרויקט (שרת הפיתוח), ואם אין - הכתובת מה-Storage
 * (שבחדר צריכה אישור NetFree לסרטונים - ראו סעיף 9 ב-CLAUDE.md).
 */
function RoomRecordings({
  groups,
  manualIndex,
}: {
  groups: Group[];
  /** מעבר ידני (גלריית הלופים): ההקלטה הזו מתנגנת בלולאה, וכל נגיעה = הבאה */
  manualIndex?: number;
}) {
  const manual = manualIndex !== undefined;
  const workshopId = groups[0]?.workshop_id ?? "";
  const { items: media } = useMedia(workshopId, 7);
  const transcripts = useClipTranscripts(workshopId);
  const [projectClips, setProjectClips] = useState<string[]>([]);

  useEffect(() => {
    if (!workshopId) return;
    const load = () => listProjectClips(workshopId).then(setProjectClips);
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [workshopId]);

  // ההקלטה האחרונה של כל קבוצה, לפי סדר המסכים
  const clips = useMemo(
    () =>
      groups
        .map((g) => {
          const rows = media.filter((m) => m.group_id === g.id);
          const last = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (!last) return null;
          const src = projectClips.includes(g.id) ? projectClipUrl(workshopId, g.id) : last.url;
          return { group: g, src };
        })
        .filter((c): c is { group: Group; src: string } => c !== null),
    [groups, media, projectClips, workshopId],
  );

  const [autoIndex, setIndex] = useState(0);
  const index = manual ? manualIndex : autoIndex;
  const current = clips.length > 0 ? clips[((index % clips.length) + clips.length) % clips.length] : null;
  const next = () => setIndex((i) => i + 1);

  return (
    <main className="rl-page rl-page--riddle rr-page" dir="rtl">
      <div className="rl-grid" aria-hidden="true" />

      <header className="rl-title">
        <span className="rl-title__sq" aria-hidden="true" />
        ההקלטות של הקבוצות
      </header>

      <section className="rr-stage">
        {current ? (
          <Featured
            key={`${current.group.id}-${index}`}
            clip={current}
            segments={transcripts[current.group.id]}
            onEnd={manual ? undefined : next}
          />
        ) : (
          <p className="rr-empty">ההקלטות יופיעו כאן ברגע שהקבוצות יסיימו להקליט.</p>
        )}
      </section>

      <ol className="rr-groups">
        {groups.map((g) => {
          const has = clips.some((c) => c.group.id === g.id);
          const playing = current?.group.id === g.id;
          return (
            <li key={g.id} className={`rr-group${has ? " is-done" : ""}${playing ? " is-playing" : ""}`}>
              <span className="rr-group__dot" aria-hidden="true" />
              <span className="rr-group__name">{g.name ?? `מסך ${g.screen_number}`}</span>
              <span className="rr-group__state">{playing ? "מתנגן עכשיו" : has ? "הוקלט" : "עוד מקליטות..."}</span>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/** ההקלטה שמתנגנת עכשיו - מושתקת, עם כתוביות; בסוף עוברים לבאה. */
function Featured({
  clip,
  segments,
  onEnd,
}: {
  clip: { group: Group; src: string };
  segments?: { start: number; end: number; text: string }[];
  /** בלי onEnd (מעבר ידני) - ההקלטה חוזרת על עצמה עד הנגיעה הבאה */
  onEnd?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [vtt, setVtt] = useState<string | null>(null);

  useEffect(() => {
    if (!segments || segments.length === 0) return;
    const url = URL.createObjectURL(new Blob([segmentsToVtt(segments)], { type: "text/vtt" }));
    setVtt(url);
    return () => URL.revokeObjectURL(url);
  }, [segments]);

  // הכתוביות מוצגות תמיד (אין קול במסך הגדול)
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    for (const track of Array.from(v.textTracks)) track.mode = "showing";
  }, [vtt]);

  return (
    <figure className="rr-featured">
      <video
        ref={ref}
        src={clip.src}
        autoPlay
        muted
        playsInline
        loop={!onEnd}
        onEnded={onEnd}
        // סרטון שלא נטען (למשל חסום) - לא נתקעים עליו
        onError={() => onEnd && window.setTimeout(onEnd, 4000)}
      >
        {vtt && <track kind="subtitles" srcLang="he" label="עברית" src={vtt} default />}
      </video>
      <figcaption className="rr-featured__name">{clip.group.name ?? `מסך ${clip.group.screen_number}`}</figcaption>
    </figure>
  );
}

export default RoomRecordings;
