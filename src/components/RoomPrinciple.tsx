import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { cleanAiHebrew } from "../lib/hebrewText";

/**
 * המסך הגדול, שלב 10 (2026-11-20): "העיקרון שעולה מהסדנה שלכן".
 *
 * אותו משפט סיום שה-AI ניסח ושלושת המסכים מציגים (responses, type
 * "closing_principle"), בגדול, עם המירכאות האדומות של מסך הסיום. המסך הגדול
 * רק קורא - הוא לא מבקש ניסוח בעצמו (את זה עושים מסכי הקבוצות, פעם אחת).
 *
 * פתוח מול הלקוחה: "5 חלוניות להזנת עקרונות שעלו מהסדנה" - לא ברור עדיין מה
 * הכוונה, ולכן כאן מוצג המשפט היחיד שקיים היום.
 */
const POLL_MS = 3000;

function QuoteMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
      <path d="M70 0 H110 L92 60 Q88 78 70 86 L66 78 Q76 70 78 58 H62 Z" />
      <path d="M18 0 H58 L40 60 Q36 78 18 86 L14 78 Q24 70 26 58 H10 Z" />
    </svg>
  );
}

function RoomPrinciple({ workshopId, demo }: { workshopId: string; demo?: string }) {
  const [sentence, setSentence] = useState(demo ?? "");

  useEffect(() => {
    if (demo || !workshopId) return;
    let alive = true;
    const load = () =>
      supabase
        .from("responses")
        .select("data")
        .eq("workshop_id", workshopId)
        .eq("stage_number", 10)
        .eq("type", "closing_principle")
        .order("created_at")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          const s = (data?.data as { sentence?: string } | null)?.sentence ?? "";
          if (alive && s) setSentence(s);
        });
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [workshopId, demo]);

  const words = cleanAiHebrew(sentence).split(/\s+/).filter(Boolean);

  return (
    <main className="rl-page rl-page--riddle rp-page" dir="rtl">
      <div className="rl-grid" aria-hidden="true" />
      <header className="rl-title">
        <span className="rl-title__sq" aria-hidden="true" />
        העיקרון שעולה מהסדנה שלכן
      </header>

      {words.length > 0 ? (
        <blockquote className="rp-quote">
          <QuoteMark className="rp-qm" />
          <p className="rp-sentence">
            {words.map((w, i) => (
              <span key={i} className="rp-word" style={{ animationDelay: `${0.6 + i * 0.09}s` }}>
                {w}{" "}
              </span>
            ))}
          </p>
        </blockquote>
      ) : (
        <p className="rp-wait">העיקרון שלכן מתנסח עכשיו...</p>
      )}
    </main>
  );
}

export default RoomPrinciple;
