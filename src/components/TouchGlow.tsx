import { useEffect } from "react";

/*
 * ============================================================================
 *  משוב מגע - עיגול שנפתח מנקודת הנגיעה (2026-11-14, עודכן 2026-11-15)
 * ============================================================================
 *
 *  1. **על כפתור** (בקשת המפתחת 2026-11-15, כמו הכפתורים ב-chance-chany):
 *     עיגול נפתח **בתוך הכפתור, בדיוק מהנקודה שבה נגעו**, וממלא אותו -
 *     הכפתור "מתמלא" מהאצבע החוצה. בהרמה העיגול נמוג. הטקסט נשאר מעליו:
 *     העיגול יושב בשכבה שמתחת לתוכן (z-index -1 בתוך isolation).
 *       - כפתור ראשי (אדום): מתמלא בכחול, הכתב הלבן נשאר לבן.
 *       - כפתור קטן משני / שקוף: מתמלא בכחול, והכתב מתהפך ללבן.
 *       - אריח גדול (כרטיס לחיץ): גוון כחול שקוף בלבד - כך הטקסט הכהה
 *         שבתוכו נשאר קריא.
 *  2. **בכל מקום אחר**: הילה רכה מתחת לאצבע (כמו קודם).
 *
 *  "לא תקוע": נדלק ב-pointerdown (לא בהרמה), רק transform/opacity, נמחק
 *  לבד, ולא חוסם נגיעות. "התחילו" (data-no-glow) - יש לו עיגול משלו.
 *  ב-prefers-reduced-motion - כבוי. CSS: .tf / .tg ב-editorial.css.
 */

const MAX_GLOWS = 6;
const FILL_IN_MS = 420;

function TouchGlow() {
  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // דפדפן ישן - ממשיכים
    }
    if (reduced) return;

    const glows: HTMLElement[] = [];

    function glowAt(x: number, y: number) {
      const el = document.createElement("span");
      el.className = "tg";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.addEventListener("animationend", () => {
        el.remove();
        const i = glows.indexOf(el);
        if (i >= 0) glows.splice(i, 1);
      });
      document.body.appendChild(el);
      glows.push(el);
      if (glows.length > MAX_GLOWS) glows.shift()?.remove();
    }

    function fillButton(btn: HTMLElement, e: PointerEvent) {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      // קוטר שמגיע מהנקודה עד הפינה הרחוקה - העיגול מכסה את כל הכפתור
      const d = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));

      const cs = getComputedStyle(btn);
      const primary = btn.matches(".glass-btn-primary, .bt-btn, .ed-btn, .tp-btn");
      const large = r.height > 110 || r.width > 520;
      const tone = primary ? "tf--primary" : large ? "tf--soft" : "tf--solid";

      /*
        לא דרך מחלקות על הכפתור עצמו: רכיבי React מרנדרים את הכפתור מחדש
        בלחיצה (is-pressed) ודורסים כל מחלקה שהוספנו - ככה העיגול "ברח"
        מחוץ לכפתור. במקום זה: שכבת חיתוך משלנו בתוך הכפתור (.tf-clip),
        וסגנון inline בלבד (React לא נוגע במאפייני style שהוא לא מנהל).
      */
      const restore = { position: btn.style.position, isolation: btn.style.isolation, color: btn.style.color };
      if (cs.position === "static") btn.style.position = "relative";
      btn.style.isolation = "isolate";
      if (tone === "tf--solid") btn.style.color = "#ffffff";

      const clip = document.createElement("span");
      clip.className = "tf-clip";
      clip.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = `tf ${tone}`;
      fill.style.left = `${x}px`;
      fill.style.top = `${y}px`;
      fill.style.width = `${d}px`;
      fill.style.height = `${d}px`;
      clip.appendChild(fill);
      btn.appendChild(clip);
      const born = performance.now();

      const release = () => {
        window.removeEventListener("pointerup", release, true);
        window.removeEventListener("pointercancel", release, true);
        // נותנים לעיגול לסיים להתמלא, ורק אז הוא נמוג
        const wait = Math.max(0, FILL_IN_MS - (performance.now() - born));
        window.setTimeout(() => {
          fill.classList.add("tf--out");
          window.setTimeout(() => {
            clip.remove();
            if (!btn.querySelector(".tf-clip")) {
              btn.style.position = restore.position;
              btn.style.isolation = restore.isolation;
              btn.style.color = restore.color;
            }
          }, 340);
        }, wait);
      };
      window.addEventListener("pointerup", release, true);
      window.addEventListener("pointercancel", release, true);
    }

    function onDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-no-glow]")) return;
      const btn = target?.closest?.("button, [role='button']") as HTMLElement | null;
      if (btn && !(btn as HTMLButtonElement).disabled && btn.getAttribute("aria-disabled") !== "true") {
        fillButton(btn, e);
      } else {
        glowAt(e.clientX, e.clientY);
      }
    }

    // capture: גם כשרכיב עוצר את האירוע (stopPropagation) - המשוב מופיע
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      glows.forEach((el) => el.remove());
    };
  }, []);

  return null;
}

export default TouchGlow;
