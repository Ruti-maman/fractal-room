import { useLayoutEffect, useRef, useState } from "react";

/**
 * טקסט בשורה אחת, בגודל קבוע. אם הוא ארוך מהמקום - הוא זז לאט הלוך וחזור
 * כל הזמן, כך שאפשר לקרוא אותו עד הסוף בלי להקטין את הכתב ובלי "...".
 * (דרישת הלקוחה לסולם ההשראות.) טקסט שנכנס - עומד במקום.
 *
 * ב-prefers-reduced-motion: בלי תנועה, הטקסט יורד שורה במקום.
 */
function MarqueeText({ text, className }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    function measure() {
      const box = boxRef.current;
      const inner = textRef.current;
      if (!box || !inner) return;
      setOverflow(Math.max(0, Math.ceil(inner.scrollWidth - box.clientWidth)));
    }
    measure();
    // הפונט נטען אחרי הרינדור הראשון - מודדים שוב כשהוא מוכן
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [text]);

  // מהירות קבועה (~30px לשנייה) + עצירה קצרה בכל קצה, כדי שיספיקו לקרוא
  const seconds = Math.max(4, overflow / 30 + 3);

  return (
    <span ref={boxRef} className={`block min-w-0 overflow-hidden ${className ?? ""}`}>
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap motion-reduce:whitespace-normal"
        style={
          overflow > 0
            ? {
                ["--marquee-distance" as string]: `${overflow}px`,
                animation: `marquee-rtl ${seconds}s ease-in-out infinite alternate`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}

export default MarqueeText;
