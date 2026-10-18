import Icon from "./ui/Icon";

/*
  חלוניות טיפים שקופצות אחת אחרי השנייה משני צידי הכרטיס המרכזי.
  משמשות בשלב 2 (שם הקבוצה) ובשלב 6 (טיפים לדיון טוב).

  מיקומי החלוניות: שלוש מימין לכרטיס ושתיים משמאלו, בגובה האמצעי של
  המסך - מתחת לסרגל העליון ומעל מד ההתקדמות והטיימר שבפינות.
  הכותרת קופצת ראשונה, מעל הטיפים שמימין.
*/
const TIP_SLOTS: TipSlot[] = [
  { side: "right", top: "30%" },
  { side: "left", top: "34%" },
  { side: "right", top: "47%" },
  { side: "left", top: "53%" },
  { side: "right", top: "64%" },
];

export interface Tip {
  title: string;
  text: string;
}

export type TipSlot = { side: "right" | "left"; top: string };

function TipPopups({
  title,
  tips,
  hidden,
  onClose,
  slots = TIP_SLOTS,
  titleTop = "19%",
}: {
  title: string;
  tips: Tip[];
  hidden: number[];
  onClose: (index: number) => void;
  /** מיקומים אחרים - לשלב שיש בו כרום נוסף בצדדים (סולם ההשראות משלב 3). */
  slots?: TipSlot[];
  titleTop?: string;
}) {
  // מרחק מקצה המסך: בין הקצה לבין הכרטיס (max-w-5xl = 64rem במרכז)
  const edge = "max(1.25rem, calc(50% - 32rem - 21rem))";
  return (
    <div aria-label={title} className="pointer-events-none fixed inset-0 z-40">
      <div
        className="glass glass-raised text-accent-soft pointer-events-auto absolute flex w-[19rem] items-center gap-2 rounded-2xl px-4 py-3 text-lg font-extrabold"
        style={{ top: titleTop, right: edge, animation: "pop-in 0.5s 0.2s var(--ds-ease-spring) both" }}
      >
        <Icon name="lightbulb" size={20} />
        {title}
      </div>
      {tips.map((tip, i) =>
        hidden.includes(i) ? null : (
          <div
            key={tip.title}
            role="note"
            className="glass glass-raised pointer-events-auto absolute flex w-[19rem] items-start gap-3 rounded-2xl px-4 py-3 text-start"
            style={{
              top: slots[i % slots.length].top,
              [slots[i % slots.length].side]: edge,
              animation: `pop-in 0.55s ${0.6 + i * 0.55}s var(--ds-ease-spring) both`,
            }}
          >
            <span
              aria-hidden="true"
              className={`bubble bubble--${(i % 5) + 1} mt-1 h-4 w-4 flex-none`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-ink text-xl font-extrabold">{tip.title}</span>
              <span className="text-ink-2 text-base leading-snug">{tip.text}</span>
            </div>
            <button
              type="button"
              aria-label={`סגירת הטיפ ${tip.title}`}
              onClick={() => onClose(i)}
              className="text-ink-3 hover:text-ink -me-1 flex h-8 w-8 flex-none items-center justify-center rounded-full"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ),
      )}
    </div>
  );
}

export default TipPopups;
