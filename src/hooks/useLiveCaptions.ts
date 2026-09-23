import { useEffect, useRef, useState } from "react";

/**
 * כתוביות חיות בזמן הדיבור - זיהוי דיבור של הדפדפן (Web Speech API), בעברית.
 *
 * למה זה נפרד מהתמלול שבשרת: כאן המטרה היא שהמשתתפות יראו את המילים שלהן
 * **תוך כדי** ההקלטה, ולכן זה חייב לרוץ בדפדפן עצמו. התמלול המדויק לצפייה
 * מתבצע אחר כך ב-Edge Function (supabase/functions/transcribe-clip).
 *
 * שתי מגבלות שחייבות להיות מטופלות בשקט, בלי לשבור את ההקלטה:
 * 1. בכרום, זיהוי הדיבור שולח את הקול לשרתי Google. ברשת מסוננת הבקשה הזו
 *    עלולה להיחסם, ואז מתקבלת שגיאת "network". ראו סעיף 9 ב-CLAUDE.md -
 *    זו תלות אופציונלית: אם היא חסומה, הכול ממשיך לעבוד בלי הכתוביות החיות.
 * 2. בדפדפנים ישנים ובחלק מה-WebView של אנדרואיד ה-API לא קיים כלל.
 *
 * בשני המקרים ההקלטה עצמה לא מושפעת - היא רצה דרך MediaRecorder בנפרד לגמרי.
 */

type RecognitionState = "idle" | "listening" | "unsupported" | "blocked";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** כמה תווים להשאיר על המסך - כתובית היא שורה-שתיים, לא תמליל מלא. */
const MAX_CHARS = 120;

export function useLiveCaptions(active: boolean) {
  const [text, setText] = useState("");
  const [state, setState] = useState<RecognitionState>("idle");
  const finalTextRef = useRef("");

  useEffect(() => {
    if (!active) {
      setText("");
      finalTextRef.current = "";
      setState("idle");
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    let stopped = false;
    const recognition = new Ctor();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTextRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      const combined = (finalTextRef.current + interim).trim();
      setText(combined.length > MAX_CHARS ? "…" + combined.slice(-MAX_CHARS) : combined);
    };

    recognition.onerror = (event) => {
      // "network" = הבקשה לשרתי הזיהוי נחסמה (סינון/נתק). "not-allowed" =
      // אין הרשאת מיקרופון. בשני המקרים פשוט לא מציגים כתוביות חיות.
      if (event.error === "network" || event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true;
        setState("blocked");
      }
    };

    // הזיהוי נעצר מעצמו אחרי שקט; מפעילים מחדש כל עוד מקליטים.
    recognition.onend = () => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        // כבר רץ, או שהדפדפן חסם הפעלה מחדש - לא קריטי.
      }
    };

    try {
      recognition.start();
      setState("listening");
    } catch {
      setState("unsupported");
    }

    return () => {
      stopped = true;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // כלום - האובייקט נזרק ממילא.
      }
    };
  }, [active]);

  return { text, state };
}
