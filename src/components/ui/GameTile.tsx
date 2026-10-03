/*
 * ============================================================================
 *  אריח משחק + תג שלב
 * ============================================================================
 *
 *  הרפרנס: Microsoft Solitaire Collection. מה שעושה שם את התחושה של
 *  "משחק" הוא לא הצבעוניות אלא **המבנה**, ואפשר לקחת אותו כמו שהוא גם
 *  לפלטה אחת:
 *
 *    1. **כל אריח הוא סצנה.** לא מלבן עם טקסט - חלק עליון מאויר עם
 *       אופק, שכבות ועומק, שנותן לאריח זהות משלו.
 *    2. **תג שלב עגול** שיושב על גבול הסצנה והגוף, עם טבעת סביבו.
 *       זה האלמנט שהכי מזוהה עם "משחק", והוא גם אומר בדיוק איפה אנחנו.
 *    3. **כותרת שמנה עם אייקון** בראש האריח, על גבי הסצנה.
 *    4. **ברק** - האריחים נראים מצופים, לא מט.
 *
 *  מה **לא** לקחנו משם: את הקשת. שם כל משחק בצבע אחר; כאן הכל טורקיז,
 *  והבידול בין האריחים מגיע מהסצנה ומהעומק ולא מגוון חדש. זו ההנחיה
 *  המפורשת של הלקוחה (סעיף 3 ב-CLAUDE.md).
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import Icon, { type IconName } from "./Icon";

/* ==========================================================================
   תג השלב
   ========================================================================== */

interface BadgeProps {
  /** המספר הגדול בתוך התג. */
  value: ReactNode;
  /** הכיתוב הקטן מעליו, למשל "שלב". */
  label?: string;
  /** 0 עד 1 - כמה מהטבעת מלאה. בלעדיו הטבעת מלאה. */
  progress?: number;
  size?: number;
  className?: string;
}

/**
 * התג העגול עם הטבעת - החתימה הוויזואלית של הרפרנס.
 *
 * הטבעת היא SVG ולא `border`, כי רק כך אפשר למלא אותה חלקית
 * (`strokeDasharray`) ולהשתמש באותו רכיב גם כמד התקדמות.
 */
export function LevelBadge({
  value,
  label = "שלב",
  progress = 1,
  size = 92,
  className,
}: BadgeProps) {
  const r = 44;
  const circumference = 2 * Math.PI * r;

  return (
    <span
      className={cx("relative inline-flex flex-none items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* הילה מאחורי התג - מה שגורם לו להיראות מואר ולא מודבק */}
      <span
        aria-hidden="true"
        className="bg-glow absolute inset-0 rounded-full blur-lg opacity-70"
      />

      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--ds-glass-strong)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--ds-accent-soft)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
          style={{
            transition: "stroke-dashoffset 600ms var(--ds-ease-spring)",
            filter: "drop-shadow(0 0 6px var(--ds-glow))",
          }}
        />
      </svg>

      <span
        className="glass glass-active relative flex flex-col items-center justify-center rounded-full leading-none"
        style={{ width: size - 18, height: size - 18 }}
      >
        <span className="text-[0.55em] font-bold opacity-75" style={{ fontSize: size * 0.14 }}>
          {label}
        </span>
        <span className="font-extrabold" style={{ fontSize: size * 0.34 }}>
          {value}
        </span>
      </span>
    </span>
  );
}

/* ==========================================================================
   הסצנות
   ========================================================================== */

export type TileScene = "peaks" | "horizon" | "arc" | "grid" | "bloom";

/**
 * האיור בראש האריח. כולן באותה פלטה ובאותו עיקרון - שכבות שיוצרות
 * אופק ועומק - ונבדלות בצורה בלבד, כך שלכל אריח יש זהות משלו בלי
 * להוסיף ולו גוון אחד חדש.
 */
function Scene({ scene }: { scene: TileScene }) {
  return (
    <svg
      viewBox="0 0 320 150"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16484c" />
          <stop offset="100%" stopColor="#23706e" />
        </linearGradient>
      </defs>

      <rect width="320" height="150" fill={`url(#sky-${scene})`} />

      {scene === "peaks" && (
        <>
          <path d="M0 150 L70 62 L132 150Z" fill="#3c8481" opacity="0.9" />
          <path d="M96 150 L178 44 L262 150Z" fill="#59a8a2" opacity="0.95" />
          <path d="M214 150 L286 76 L320 116 L320 150Z" fill="#7cc5c0" opacity="0.9" />
          <circle cx="248" cy="40" r="17" fill="#e8fffd" opacity="0.95" />
        </>
      )}

      {scene === "horizon" && (
        <>
          <circle cx="160" cy="104" r="46" fill="#d0efee" opacity="0.95" />
          <rect y="104" width="320" height="46" fill="#0d3134" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x="0"
              y={112 + i * 10}
              width="320"
              height="3"
              fill="#a7e9e5"
              opacity={0.65 - i * 0.12}
            />
          ))}
        </>
      )}

      {scene === "arc" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              cx="160"
              cy="168"
              r={46 + i * 30}
              fill="none"
              stroke="#a7e9e5"
              strokeWidth="3"
              opacity={0.7 - i * 0.14}
            />
          ))}
          <circle cx="160" cy="168" r="30" fill="#eafffe" opacity="0.95" />
        </>
      )}

      {scene === "grid" && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={`v${i}`}
              x1={30 + i * 52}
              y1="0"
              x2={-40 + i * 90}
              y2="150"
              stroke="#7cc5c0"
              strokeWidth="2"
              opacity="0.65"
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={58 + i * 26}
              x2="320"
              y2={58 + i * 26}
              stroke="#7cc5c0"
              strokeWidth="2"
              opacity={0.6 - i * 0.1}
            />
          ))}
        </>
      )}

      {scene === "bloom" && (
        <>
          <circle cx="160" cy="78" r="58" fill="#3c8481" opacity="0.8" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={160 + Math.cos(a) * 30}
                y1={78 + Math.sin(a) * 30}
                x2={160 + Math.cos(a) * 74}
                y2={78 + Math.sin(a) * 74}
                stroke="#c7f5f4"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.75"
              />
            );
          })}
          <circle cx="160" cy="78" r="26" fill="#f0fffe" opacity="0.96" />
        </>
      )}

      {/* ערפל בתחתית הסצנה - מה שמחבר אותה לגוף האריח בלי קו חיתוך */}
      <rect y="96" width="320" height="54" fill="url(#fade)" />
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05100f" stopOpacity="0" />
          <stop offset="100%" stopColor="#05100f" stopOpacity="0.88" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ==========================================================================
   האריח
   ========================================================================== */

interface TileProps {
  title: ReactNode;
  icon?: IconName;
  scene?: TileScene;
  /** תג עגול בגבול הסצנה והגוף. */
  badge?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  /** כיתוב קטן בתחתית, כמו "לבחירה". */
  footer?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function GameTile({
  title,
  icon,
  scene = "peaks",
  badge,
  children,
  onClick,
  footer,
  className,
  style,
}: TileProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "glass glass-brick group relative flex w-full flex-col overflow-hidden rounded-2xl text-center",
        onClick && "glass-interactive glass-3d",
        className,
      )}
      style={style}
    >
      {/* --- הסצנה --- */}
      <div className="relative h-[8.5rem] w-full flex-none overflow-hidden">
        <Scene scene={scene} />

        {/* הכותרת יושבת על הסצנה, כמו ברפרנס */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 p-4">
          {icon && <Icon name={icon} size={20} className="text-accent-pale flex-none" />}
          <span
            className="text-xl font-extrabold tracking-tight text-white sm:text-2xl"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.75)" }}
          >
            {title}
          </span>
        </div>
      </div>

      {/* --- התג, יושב בדיוק על הגבול --- */}
      {badge && (
        <div className="relative z-10 -mt-11 flex justify-center">{badge}</div>
      )}

      {/* --- הגוף --- */}
      <div
        className={cx(
          "flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-5",
          badge ? "pt-3" : "pt-5",
        )}
      >
        {children}
        {footer && (
          <span className="text-ink-3 group-hover:text-ink-2 mt-1 text-sm font-bold transition-colors">
            {footer}
          </span>
        )}
      </div>
    </Tag>
  );
}

export default GameTile;
