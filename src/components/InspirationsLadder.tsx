import { useTopInspirations } from "../hooks/useTopInspirations";
import Icon from "./ui/Icon";

interface Props {
  workshopId: string;
}

/**
 * "סולם ההשראות" - ההשראות שנבחרו בשלב 3, מוצגות מהשלב החשוב ביותר כלפי
 * מטה. מוזרק גלובלית מ-StageRouter לכל השלבים משלב 4 (שקף 6) ואילך, לפי
 * בקשת הלקוחה - לא רק בתוך שלב 4 עצמו. אם עדיין לא נבחרה אף השראה, לא
 * מוצג כלום.
 *
 * ----------------------------------------------------------------------------
 * מה השתנה בעיצוב, ולמה
 * ----------------------------------------------------------------------------
 * הגרסה הקודמת ציירה סולם עץ ממשי (שני מוטות + שלבים) מוטה ב-3 מעלות,
 * עם המילים מרחפות מעליו וצל טקסט שיחזיק אותן קריאות מול כל רקע. זה עבד,
 * אבל היה האובייקט היחיד בסדנה שלא היה עשוי מאותו חומר כמו כל השאר - וגם
 * הסיבוב וגודל האותיות הקבוע היו נשברים על מסך צר.
 *
 * כאן הסולם הוא רכיב זכוכית ככל השאר: מסילה אנכית צרה בקצה המסך, שכל שלב
 * בה הוא לבנה קטנה. ההיררכיה נשמרת - הראשונה מוארת (glass-active) והשאר
 * שקופות ומתעמעמות כלפי מטה, כך שסדר החשיבות עדיין נקרא במבט אחד.
 *
 * המסילה `pointer-events-none`: היא תצוגה בלבד, ואסור שתחסום נגיעה על
 * הקנבס של שלב 4 שנמצא מתחתיה.
 */
function InspirationsLadder({ workshopId }: Props) {
  const { items, loading } = useTopInspirations(workshopId);

  if (loading || items.length === 0) return null;

  return (
    <aside
      aria-label="סולם ההשראות שנבחרו"
      className="glass glass-brick pointer-events-none fixed top-24 left-4 z-20 hidden w-[10.5rem] flex-col gap-2 rounded-xl p-3 lg:flex"
      style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
    >
      <div className="text-ink-3 flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wide">
        <Icon name="ladder" size={14} />
        סולם ההשראות
      </div>

      <ol className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={item.text}
            className={
              i === 0
                ? "glass glass-active flex items-center gap-2 rounded-sm px-2.5 py-2"
                : "glass glass-dim flex items-center gap-2 rounded-sm px-2.5 py-2"
            }
            style={{
              // כל שלב נמוך יותר מעט יותר עמום - הסדר עצמו הוא המידע
              opacity: i === 0 ? 1 : Math.max(0.5, 1 - i * 0.14),
              animation: `fade-up var(--ds-dur-slow) ${i * 70}ms var(--ds-ease) both`,
            }}
          >
            <span
              aria-hidden="true"
              className={
                i === 0
                  ? "text-[10px] font-extrabold opacity-80"
                  : "text-ink-3 text-[10px] font-extrabold"
              }
            >
              {i + 1}
            </span>
            <span className="truncate text-[13px] font-bold">{item.text}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export default InspirationsLadder;
