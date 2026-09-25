import { useEffect, useMemo } from "react";
import { normalizeVotes, useRatings } from "../../hooks/useRatings";
import type { Group } from "../../types/group";

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

/** פלטת הצבעים של הסדנה - אותה פלטה של שלב 7, לקונפטי ולפודיום. */
const PALETTE = ["#6fcf7e", "#9ed75b", "#5bc0eb", "#f5a25d", "#f07b7b", "#ffd75e"];

/**
 * פתיתי הקונפטי. המיקום, הצבע והמהירות של כל פתית קבועים ולא אקראיים בזמן
 * ריצה, כדי שהם לא "יקפצו" בכל רינדור מחדש. 60 פתיתים זה מספיק לתחושת חגיגה
 * בלי להעמיס על הפלזמות (סעיף 2 ב-CLAUDE.md - דפדפן שעשוי להיות ישן).
 */
const CONFETTI = Array.from({ length: 60 }, (_, i) => {
  const rand = (seed: number) => ((Math.sin(i * seed) + 1) / 2);
  return {
    left: Math.round(rand(12.9898) * 98),
    delay: +(rand(78.233) * 6).toFixed(2),
    duration: +(3.6 + rand(43.7) * 3.4).toFixed(2),
    drift: Math.round(rand(93.1) * 220 - 110),
    spin: Math.round(360 + rand(17.3) * 900),
    width: 7 + Math.round(rand(29.7) * 6),
    height: 11 + Math.round(rand(55.1) * 10),
    color: PALETTE[i % PALETTE.length],
    round: i % 4 === 0,
  };
});

/** פנפרת ניצחון קצרה - רצף עולה ואז אקורד. */
function playWinSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();

    const note = (freq: number, start: number, length: number, volume = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + length + 0.05);
    };

    // דו-מי-סול-דו עולה, ואז אקורד מנצח
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.13, 0.22));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 0.62, 1.1, 0.12));
  } catch {
    // בלי צליל אם הדפדפן לא תומך - לא עוצרים את הזרימה.
  }
}

/** גביע זהב מצויר, עם ברק על המתכת. */
function Trophy() {
  return (
    <svg viewBox="0 0 120 130" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="35%" stopColor="#ffd75e" />
          <stop offset="65%" stopColor="#e8a92b" />
          <stop offset="100%" stopColor="#ffdf7a" />
        </linearGradient>
        <linearGradient id="goldDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8a92b" />
          <stop offset="100%" stopColor="#b97d16" />
        </linearGradient>
      </defs>

      {/* ידיות */}
      <path
        d="M28 22H14c0 20 6 30 18 33"
        fill="none"
        stroke="url(#goldDark)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M92 22h14c0 20-6 30-18 33"
        fill="none"
        stroke="url(#goldDark)"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* גוף הגביע */}
      <path d="M28 14h64v26c0 20-14 34-32 34S28 60 28 40V14z" fill="url(#gold)" />
      <path d="M28 14h64v8H28z" fill="url(#goldDark)" />

      {/* ברק על המתכת */}
      <path d="M40 22c-2 14 0 26 8 34-10-4-16-18-14-34z" fill="#fff8d6" opacity="0.65" />

      {/* רגל ובסיס */}
      <rect x="54" y="72" width="12" height="20" fill="url(#goldDark)" />
      <rect x="40" y="92" width="40" height="9" rx="3" fill="url(#gold)" />
      <rect x="32" y="101" width="56" height="13" rx="4" fill="url(#goldDark)" />

      {/* כוכב על הגביע */}
      <path
        d="M60 30l4.2 8.5 9.4 1.4-6.8 6.6 1.6 9.3-8.4-4.4-8.4 4.4 1.6-9.3-6.8-6.6 9.4-1.4z"
        fill="#fff8d6"
        opacity="0.9"
      />
    </svg>
  );
}

function Stage8Winner({ workshopId, myGroup, allGroups, onAdvance }: Props) {
  const { rows } = useRatings(workshopId, myGroup.id);

  // הדירוג בשלב 7 הוא "לייק": כל בת מסמנת כוכב אחד, ולכן המנצחת היא מי
  // שצברה הכי הרבה לייקים - לא ממוצע (כל הלייקים שווים 1). normalizeVotes
  // מטפלת גם בהפעלות ישנות שבהן נשמר דירוג 1-5 בודד.
  const ranking = useMemo(() => {
    const likes: Record<string, number> = {};
    for (const row of rows) {
      for (const [groupId, votes] of Object.entries(normalizeVotes(row.data))) {
        likes[groupId] = (likes[groupId] ?? 0) + votes.length;
      }
    }
    return allGroups
      .map((group) => ({ group, likes: likes[group.id] ?? 0 }))
      .sort((a, b) => b.likes - a.likes || a.group.screen_number - b.group.screen_number);
  }, [rows, allGroups]);

  const winner = ranking[0];
  const hasVotes = ranking.some((entry) => entry.likes > 0);

  useEffect(() => {
    if (hasVotes) playWinSound();
  }, [hasVotes]);

  // סדר התצוגה בפודיום: שנייה, ראשונה במרכז, שלישית - כמו פודיום אמיתי
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const heights = [112, 158, 88];
  const medals = ["🥈", "🥇", "🥉"];

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden px-8 py-6 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 8%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 58%, var(--color-smoke-blue-darker) 100%)",
      }}
    >
      {/* קונפטי - רק כשיש תוצאה אמיתית להכריז עליה */}
      {hasVotes && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {CONFETTI.map((piece, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={{
                insetInlineStart: `${piece.left}%`,
                width: piece.width,
                height: piece.round ? piece.width : piece.height,
                background: piece.color,
                borderRadius: piece.round ? "9999px" : "2px",
                ["--drift" as string]: `${piece.drift}px`,
                ["--spin" as string]: `${piece.spin}deg`,
                animation: `confetti-fall ${piece.duration}s ${piece.delay}s linear infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* כתמי אור בפינות - קו העיצוב הקבוע */}
      <div className="pointer-events-none absolute top-[-12%] left-[-6%] h-[28rem] w-[28rem] rounded-full bg-[#ffd75e]/10 blur-[130px]" />
      <div className="pointer-events-none absolute right-[-8%] bottom-[-14%] h-[30rem] w-[30rem] rounded-full bg-[#5bc0eb]/12 blur-[130px]" />

      <span
        className="relative rounded-full border border-[#ffd75e]/40 px-5 py-1.5 text-xs font-bold tracking-widest text-[#ffd75e] uppercase"
        style={{ animation: "fade-up 0.6s ease-out both" }}
      >
        שלב 8 · הכרזת המנצחת
      </span>

      {/* הגביע, עם קרני אור מסתובבות מאחוריו וניצוצות */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div
          className="pointer-events-none absolute h-[26rem] w-[26rem] opacity-40"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,215,94,0.55) 0deg, transparent 22deg, rgba(255,215,94,0.45) 45deg, transparent 67deg, rgba(255,215,94,0.5) 90deg, transparent 112deg, rgba(255,215,94,0.45) 135deg, transparent 157deg, rgba(255,215,94,0.5) 180deg, transparent 202deg, rgba(255,215,94,0.45) 225deg, transparent 247deg, rgba(255,215,94,0.5) 270deg, transparent 292deg, rgba(255,215,94,0.45) 315deg, transparent 337deg)",
            maskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            animation: "rays-spin 24s linear infinite",
          }}
        />
        <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#ffd75e]/25 blur-[60px]" />

        <div
          className="relative h-40 w-40"
          style={{
            animation: "trophy-float 3.4s ease-in-out infinite",
            filter: "drop-shadow(0 12px 30px rgba(255,215,94,0.45))",
          }}
        >
          <Trophy />
        </div>

        {/* ניצוצות סביב הגביע */}
        {[
          { top: "6%", left: "12%", size: 22, delay: 0 },
          { top: "18%", left: "84%", size: 16, delay: 0.7 },
          { top: "72%", left: "4%", size: 14, delay: 1.4 },
          { top: "62%", left: "90%", size: 20, delay: 2.1 },
          { top: "2%", left: "58%", size: 13, delay: 2.8 },
        ].map((sp) => (
          <span
            key={`${sp.top}-${sp.left}`}
            className="pointer-events-none absolute text-[#fff3b0]"
            style={{
              top: sp.top,
              insetInlineStart: sp.left,
              fontSize: sp.size,
              animation: `sparkle 2.6s ${sp.delay}s ease-in-out infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      {/* שם המנצחת */}
      {winner && hasVotes ? (
        <div className="relative flex flex-col items-center gap-2">
          <p className="text-lg font-bold text-white/60">הקבוצה המנצחת</p>
          <h1
            className="text-5xl font-black tracking-tight"
            style={{
              backgroundImage: "linear-gradient(135deg, #fff3b0, #ffd75e 45%, #e8a92b)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 0 40px rgba(255,215,94,0.35)",
              animation: "winner-in 0.9s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            {winner.group.name ?? `מסך ${winner.group.screen_number}`}
          </h1>
          <p
            className="flex items-center gap-2 text-2xl font-bold text-[#ffd75e]"
            style={{ animation: "fade-up 0.8s 0.6s ease-out both" }}
          >
            <span>★</span>
            {winner.likes} {winner.likes === 1 ? "כוכב" : "כוכבים"}
          </p>
        </div>
      ) : (
        <h1 className="relative text-3xl font-bold text-white/70">אף קבוצה לא קיבלה כוכבים עדיין</h1>
      )}

      {/* פודיום עם כל שלוש הקבוצות */}
      {hasVotes && (
        <div className="relative flex items-end justify-center gap-4 pb-1">
          {podium.map((entry, i) => {
            const isWinner = entry.group.id === winner?.group.id;
            return (
              <div key={entry.group.id} className="flex w-40 flex-col items-center gap-2">
                <span className="text-3xl">{medals[i]}</span>
                <span className="text-base font-bold text-white/90">
                  {entry.group.name ?? `מסך ${entry.group.screen_number}`}
                </span>
                <span className="text-sm font-bold text-[#ffd75e]">★ {entry.likes}</span>
                <div
                  className="w-full origin-bottom rounded-t-xl"
                  style={{
                    height: heights[i],
                    background: isWinner
                      ? "linear-gradient(180deg, #ffd75e, #e8a92b)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
                    boxShadow: isWinner ? "0 0 40px -8px rgba(255,215,94,0.7)" : "none",
                    animation: `podium-rise 0.7s ${0.5 + i * 0.15}s cubic-bezier(0.34, 1.3, 0.64, 1) both`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <button
        className="group relative mt-3 flex items-center gap-3 rounded-full bg-[#5bc0eb] px-14 py-4 text-xl font-bold text-white shadow-[0_10px_30px_-8px_rgba(91,192,235,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4fb2dd] active:scale-95"
        style={{ animation: "fade-up 0.9s 1s ease-out both" }}
        onClick={onAdvance}
      >
        הבא
        <span className="transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true">
          ←
        </span>
      </button>
    </main>
  );
}

export default Stage8Winner;
