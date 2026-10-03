import { useEffect, useMemo } from "react";
import { normalizeVotes, useRatings } from "../../hooks/useRatings";
import type { Group } from "../../types/group";
import { BackgroundLayers } from "../ui/AppBackground";
import Icon from "../ui/Icon";
import { cx } from "../../lib/cx";

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

/*
 * ============================================================================
 *  שלב 8 - הכרזת המנצחת
 * ============================================================================
 *
 *  ----------------------------------------------------------------------
 *  למה הגביע עשוי זכוכית ולא זהב
 *  ----------------------------------------------------------------------
 *  הגרסה הקודמת הייתה מסך זהב מלא: גביע מוזהב, קרני זהב, קונפטי צבעוני
 *  בשישה צבעים, ומדליות באמוג'י. זה חגג יפה, אבל היה המסך היחיד בסדנה
 *  שלא נראה שייך אליה.
 *
 *  כאן הגביע הוא **לבנת זכוכית טורקיז** כמו כל השאר, רק שהיא היחידה
 *  שמוארת מבפנים בעוצמה מלאה. זה שומר על "רגע הפרס" בלי לצאת מהשפה -
 *  ובעצם מחזק אותו, כי הזוהר הזה לא מופיע בשום מסך אחר.
 *
 *  ----------------------------------------------------------------------
 *  שני תיקונים מעבר לעיצוב
 *  ----------------------------------------------------------------------
 *  1. **המדליות אינן אמוג'י.** 🥇 מעובד אחרת בכל דפדפן ומערכת הפעלה, ועל
 *     WebView ישן של אנדרואיד הוא עלול להיראות שונה לגמרי או לא להופיע.
 *     הפרויקט כבר נמנע מאמוג'י בדיוק מהסיבה הזו (ראו Stage5) - וכאן זה
 *     נשאר חריג. במקומן דיסקיות מצוירות עם מספר המקום.
 *  2. **הקונפטי מושהה ב-prefers-reduced-motion.** 60 פתיתים שנופלים
 *     בלולאה אינסופית הם בדיוק מה שהבקשה הזו מנסה למנוע.
 */

/**
 * פתיתי הקונפטי - רסיסי זכוכית ים. המיקום, הצבע והמהירות של כל פתית
 * קבועים ולא אקראיים בזמן ריצה, כדי שהם לא "יקפצו" בכל רינדור מחדש.
 * 60 פתיתים זה מספיק לתחושת חגיגה בלי להעמיס על הפלזמות (סעיף 2
 * ב-CLAUDE.md - דפדפן שעשוי להיות ישן).
 */
const SHARD_COLORS = ["#c7f5f4", "#a7e9e5", "#84c7c1", "#4e8f8b", "#ffffff"];

const CONFETTI = Array.from({ length: 60 }, (_, i) => {
  const rand = (seed: number) => (Math.sin(i * seed) + 1) / 2;
  return {
    left: Math.round(rand(12.9898) * 98),
    delay: +(rand(78.233) * 6).toFixed(2),
    duration: +(3.6 + rand(43.7) * 3.4).toFixed(2),
    drift: Math.round(rand(93.1) * 220 - 110),
    spin: Math.round(360 + rand(17.3) * 900),
    width: 7 + Math.round(rand(29.7) * 6),
    height: 11 + Math.round(rand(55.1) * 10),
    color: SHARD_COLORS[i % SHARD_COLORS.length],
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

/**
 * גביע זכוכית. אותה לוגיקת חומר כמו לבנת הזכוכית: פנים בהיר, קצוות
 * שמתעבים, ברק ספקולרי בפינה העליונה-שמאלית ודופן רחוקה שנראית דרך
 * הזכוכית - מה שנותן לו נפח בלי להפוך אותו למתכת.
 */
function GlassTrophy() {
  return (
    <svg viewBox="0 0 120 130" className="h-full w-full" aria-hidden="true">
      <defs>
        {/* גוף הזכוכית - בהיר למעלה, מתעבה כלפי מטה */}
        <linearGradient id="tr-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#e6fdfc" stopOpacity={0.95} />
          <stop offset="35%" stopColor="#a7e9e5" stopOpacity={0.85} />
          <stop offset="75%" stopColor="#84c7c1" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#4e8f8b" stopOpacity={0.9} />
        </linearGradient>
        {/* הקצה העבה - הבסיס והשפה */}
        <linearGradient id="tr-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7f5f4" />
          <stop offset="100%" stopColor="#316768" />
        </linearGradient>
        {/* הברק על הזכוכית */}
        <linearGradient id="tr-spec" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* ידיות */}
      <path
        d="M28 22H14c0 20 6 30 18 33"
        fill="none"
        stroke="url(#tr-edge)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M92 22h14c0 20-6 30-18 33"
        fill="none"
        stroke="url(#tr-edge)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* גוף הגביע */}
      <path d="M28 14h64v26c0 20-14 34-32 34S28 60 28 40V14z" fill="url(#tr-body)" />
      {/* השפה העליונה - אליפסה שנותנת את הנפח הגלילי */}
      <ellipse cx="60" cy="14" rx="32" ry="6" fill="url(#tr-edge)" opacity="0.95" />
      <ellipse
        cx="60"
        cy="14"
        rx="26"
        ry="4"
        fill="none"
        stroke="#e6fdfc"
        strokeWidth="1.2"
        opacity="0.55"
      />

      {/* ברק ספקולרי על הדופן */}
      <path d="M38 20c-3 15-1 28 8 37-11-5-17-21-14-37z" fill="url(#tr-spec)" />
      {/* פס שבירה בקצה הימני, כמו בלבנה */}
      <path d="M84 20c1 14 0 25-5 33" stroke="#e6fdfc" strokeWidth="1.5" fill="none" opacity="0.4" />

      {/* רגל ובסיס */}
      <rect x="54" y="72" width="12" height="20" fill="url(#tr-edge)" opacity="0.9" />
      <rect x="40" y="92" width="40" height="9" rx="3" fill="url(#tr-body)" />
      <rect x="32" y="101" width="56" height="13" rx="4" fill="url(#tr-edge)" opacity="0.95" />
      <rect x="34" y="102.5" width="52" height="3" rx="1.5" fill="#e6fdfc" opacity="0.4" />

      {/* כוכב חרוט בזכוכית */}
      <path
        d="M60 30l4.2 8.5 9.4 1.4-6.8 6.6 1.6 9.3-8.4-4.4-8.4 4.4 1.6-9.3-6.8-6.6 9.4-1.4z"
        fill="#f4feff"
        opacity="0.75"
      />
    </svg>
  );
}

/** דיסקית מקום - מחליפה את אמוג'י המדליה. */
function PlaceDisc({ place }: { place: number }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-12 w-12 items-center justify-center text-lg font-extrabold",
        place === 1 ? "bubble" : "bubble bubble-hollow text-ink-2",
      )}
    >
      {place}
    </span>
  );
}

function Stage8Winner({ workshopId, myGroup, allGroups }: Props) {
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
  const places = [2, 1, 3];

  return (
    <main className="relative flex h-dvh flex-col items-center justify-center gap-4 overflow-hidden px-6 pt-20 pb-40 text-center">
      <BackgroundLayers variant="night" />

      {/* קונפטי - רק כשיש תוצאה אמיתית להכריז עליה.
          `motion-safe` מוודא שהוא לא רץ כשביקשו פחות תנועה. */}
      {hasVotes && (
        <div className="pointer-events-none fixed inset-0 hidden overflow-hidden motion-safe:block">
          {CONFETTI.map((piece, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={{
                insetInlineStart: `${piece.left}%`,
                width: piece.width,
                height: piece.round ? piece.width : piece.height,
                background: piece.color,
                opacity: 0.85,
                borderRadius: piece.round ? "9999px" : "2px",
                ["--drift" as string]: `${piece.drift}px`,
                ["--spin" as string]: `${piece.spin}deg`,
                animation: `confetti-fall ${piece.duration}s ${piece.delay}s linear infinite`,
              }}
            />
          ))}
        </div>
      )}

      <span
        className="glass glass-chip text-accent-soft relative gap-2"
        style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
      >
        <Icon name="trophy" size={15} />
        שלב 8 · הכרזת המנצחת
      </span>

      {/* הגביע, עם קרני אור מסתובבות מאחוריו וניצוצות */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-[26rem] w-[26rem] opacity-50 motion-safe:block"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(199,245,244,0.5) 0deg, transparent 22deg, rgba(167,233,229,0.4) 45deg, transparent 67deg, rgba(199,245,244,0.45) 90deg, transparent 112deg, rgba(167,233,229,0.4) 135deg, transparent 157deg, rgba(199,245,244,0.45) 180deg, transparent 202deg, rgba(167,233,229,0.4) 225deg, transparent 247deg, rgba(199,245,244,0.45) 270deg, transparent 292deg, rgba(167,233,229,0.4) 315deg, transparent 337deg)",
            maskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            animation: "rays-spin 24s linear infinite",
          }}
        />
        <div
          aria-hidden="true"
          className="bg-glow pointer-events-none absolute h-64 w-64 rounded-full blur-[60px]"
        />

        <div
          className="relative h-40 w-40"
          style={{
            animation: "trophy-float 3.4s ease-in-out infinite",
            filter: "drop-shadow(0 12px 34px var(--ds-glow))",
          }}
        >
          <GlassTrophy />
        </div>

        {/* ניצוצות סביב הגביע - צורה מצוירת, לא תו טקסט */}
        {[
          { top: "6%", left: "12%", size: 20, delay: 0 },
          { top: "18%", left: "84%", size: 15, delay: 0.7 },
          { top: "72%", left: "4%", size: 13, delay: 1.4 },
          { top: "62%", left: "90%", size: 18, delay: 2.1 },
          { top: "2%", left: "58%", size: 12, delay: 2.8 },
        ].map((sp) => (
          <span
            key={`${sp.top}-${sp.left}`}
            aria-hidden="true"
            className="text-accent-pale pointer-events-none absolute"
            style={{
              top: sp.top,
              insetInlineStart: sp.left,
              animation: `sparkle 2.6s ${sp.delay}s ease-in-out infinite`,
            }}
          >
            <Icon name="sparkles" size={sp.size} />
          </span>
        ))}
      </div>

      {/* שם המנצחת */}
      {winner && hasVotes ? (
        <div className="relative flex flex-col items-center gap-2">
          <p className="text-ink-3 text-base font-bold">הקבוצה המנצחת</p>
          <h1
            className="glass-title text-5xl sm:text-6xl"
            style={{
              textShadow: "0 0 50px var(--ds-glow-soft)",
              animation: "winner-in 0.9s 0.2s var(--ds-ease-spring) both",
            }}
          >
            {winner.group.name ?? `מסך ${winner.group.screen_number}`}
          </h1>
          <p
            className="glass glass-pill text-accent mt-1 gap-2 px-5 py-2 text-xl font-extrabold"
            style={{ animation: "fade-up 0.8s 0.6s var(--ds-ease) both" }}
          >
            <Icon name="star" size={20} filled />
            {winner.likes} {winner.likes === 1 ? "כוכב" : "כוכבים"}
          </p>
        </div>
      ) : (
        <h1 className="glass-title relative text-3xl">אף קבוצה לא קיבלה כוכבים עדיין</h1>
      )}

      {/* פודיום עם כל שלוש הקבוצות */}
      {hasVotes && (
        <div className="relative flex items-end justify-center gap-3 pb-1 sm:gap-4">
          {podium.map((entry, i) => {
            const isWinner = entry.group.id === winner?.group.id;
            return (
              <div
                key={entry.group.id}
                className="flex w-28 flex-col items-center gap-2 sm:w-40"
              >
                <PlaceDisc place={places[i]} />
                <span className="text-ink truncate text-sm font-bold sm:text-base">
                  {entry.group.name ?? `מסך ${entry.group.screen_number}`}
                </span>
                <span className="text-accent-soft flex items-center gap-1 text-sm font-bold">
                  <Icon name="star" size={14} filled />
                  {entry.likes}
                </span>
                <div
                  className={cx(
                    "glass w-full origin-bottom rounded-t-lg",
                    isWinner && "glass-active",
                  )}
                  style={{
                    height: heights[i],
                    animation: `podium-rise 0.7s ${0.5 + i * 0.15}s var(--ds-ease-spring) both`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default Stage8Winner;
