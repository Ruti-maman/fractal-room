import { useTopInspirations } from "../hooks/useTopInspirations";

interface Props {
  workshopId: string;
}

const RUNG_GAP_PX = 108; // מרחק בין מרכזי השלבים - קובע כמה "ארוך" הסולם נראה
const TOP_OFFSET_PX = 58;
const WORD_BLOCK_HEIGHT_PX = 52; // הגובה שהמילה "יושבת" בתוכו, מעל השלב (לא עליו)
const LADDER_SCALE = 0.55; // מקטין את הסולם כולו (כולל האותיות) פרופורציונלית, בלי לגעת בכל קבוע בנפרד
const TITLE_SHADOW = "0 2px 6px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)";
// כיתוב לבן כמו הכותרת - צל כהה מאחוריו לקריאות, בלי הילה לבנה סביב האותיות.
const WORD_SHADOW = TITLE_SHADOW;

/**
 * "סולם ההשראות" - ציור דק וארוך של סולם אמיתי (שני מוטות צמודים + שלבים
 * דקים), בלי שום תיבה/מלבן מסביב למילים ובלי כרטיס-רקע מסביב לסולם עצמו -
 * לפי בקשת הלקוחה: רק המילה שנבחרה יושבת ישירות מעל השלב (עם צל-טקסט
 * שנותן קריאות על רקע הדף, לא רקע צבוע). כל השלבים באותו גוון עץ אחיד - אין
 * צבעוניות דירוג, הסדר מלמעלה למטה כבר אומר הכל.
 *
 * ממוקם ב-top-0 left-0 עם סיבוב קל סביב הפינה עצמה (origin-top-left, בלי
 * הזזה שלילית) - כדי שלעולם לא "יחתך" מעל/משמאל לדף: הסיבוב יכול רק לדחוף
 * את הסולם פנימה לתוך הדף, אף פעם לא מעבר לקצוות שלו.
 *
 * מוזרק גלובלית מ-StageRouter לכל השלבים משלב 4 (שקף 6) ואילך, לפי בקשת
 * הלקוחה - לא רק בתוך שלב 4 עצמו. אם עדיין לא נבחרה אף השראה - לא מציגה כלום.
 */
function InspirationsLadder({ workshopId }: Props) {
  const { items, loading } = useTopInspirations(workshopId);

  if (loading || items.length === 0) return null;

  const ladderHeight = items.length * RUNG_GAP_PX + TOP_OFFSET_PX;

  return (
    <div
      className="fixed top-0 left-0 z-30 origin-top-left select-none"
      style={{ transform: `scale(${LADDER_SCALE}) rotate(-3deg)` }}
    >
      <p
        className="mr-10 mb-2 text-lg font-extrabold text-white"
        style={{ textShadow: TITLE_SHADOW }}
      >
        🪜 סולם ההשראות
      </p>
      <div className="relative w-44" style={{ height: ladderHeight }}>
        {/* שני מוטות הצד - דקים וצמודים, כמו סולם אמיתי. */}
        <div className="absolute inset-y-0 right-3 w-2 rounded-full bg-wood shadow-md" />
        <div className="absolute inset-y-0 left-3 w-2 rounded-full bg-wood shadow-md" />

        {items.map((item, i) => {
          const rungTop = TOP_OFFSET_PX + i * RUNG_GAP_PX;
          return (
            <div key={item.text} className="absolute inset-x-3">
              {/* השלב עצמו - פס דק שמחבר בין שני המוטות. */}
              <div className="absolute inset-x-0 h-2 rounded-full bg-wood shadow-md" style={{ top: rungTop }} />
              {/* המילה יושבת מעל השלב, כמו חפץ שמונח עליו - לא חופפת לקו עצמו. */}
              <div
                className="absolute inset-x-0 flex items-end justify-center"
                style={{ top: rungTop - WORD_BLOCK_HEIGHT_PX, height: WORD_BLOCK_HEIGHT_PX }}
              >
                <span
                  className="px-2 pb-1 text-center text-2xl font-extrabold text-white"
                  style={{ textShadow: WORD_SHADOW }}
                >
                  {item.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InspirationsLadder;
