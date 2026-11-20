// Edge Function: מייצרת את שני משפטי "תמונת התפקוד הכוללת" (שקף 8, שלב 4
// המשך) עם AI. נקראת מהמסך דרך supabase.functions.invoke (ראו
// src/hooks/useFunctioningPicture.ts) - המפתח הסודי נשאר כאן בצד השרת
// ולעולם לא מגיע למסך, לפי האילוץ ב-CLAUDE.md ("קריאות ל-AI עוברות דרך
// Supabase Edge Functions").
//
// משתמשת ב-Google Gemini (לא Claude) - החלטה מפורשת של הלקוחה: Gemini נותנת
// מפתח API בחינם לגמרי (בלי כרטיס אשראי) דרך Google AI Studio, בזמן ש-Anthropic
// דורשת יתרה בתשלום מהבקשה הראשונה. ראו GEMINI_MODEL למטה אם צריך להחליף מודל.
//
// "המסקנה המעשית" (group_conclusion) **אינה** מיוצרת כאן בכלל - הקבוצה
// מקלידה אותה בעצמה במסך (ראו FunctioningPictureStep ב-Stage4Analysis.tsx
// ו-saveGroupConclusion ב-useFunctioningPicture.ts), לפי בקשת הלקוחה
// המפורשת: תיבה ריקה, לא הצעת AI.
//
// הפונקציה עצמה שולפת את הנתונים (השראות משלב 3 + ביטויים מתויגים משלב 4)
// ישירות מה-DB לפי workshop_id/group_id שמקבלת - כך שהמסך לא צריך לשלוח
// payload גדול, ובעיקר כדי לא לשכפל כאן קריאה ל-useTopInspirations (שכבר
// רץ במקביל מ-InspirationsLadder על אותו מסך, וקריאה כפולה הייתה מייצרת
// באג נוסף, לא קשור ל-AI, של תלות בנתון לקוח). התוצאה נשמרת ב-responses
// (type "functioning_picture") ומוחזרת גם ללקוח, כדי שהמסך יראה אותה מיד
// בלי לחכות לסבב realtime/poll נוסף.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// המודל הזול/מהיר ביותר בשכבה החינמית של Gemini - מספיק בהחלט למשימה קצרה
// כזו. אם Google מוציאה מהמחזור, מחליפים כאן בלבד.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

/*
  2026-11-16: נבדק ביומן - Gemini החזיר 503 ("currently experiencing high
  demand") לאורך כל היום, והמסך הציג "לא הצלחנו לנסח". לכן: כל מודל מקבל
  כמה ניסיונות עם המתנה ביניהם, ואם הוא עדיין עמוס (או לא קיים) - עוברים
  למודל הבא ברשימה. הראשון שעונה - מנצח.
*/
const GEMINI_FALLBACK_MODELS = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
/** ניסיונות לכל מודל כשהשגיאה זמנית (עומס / מכסה לדקה / תקלת שרת). */
const TRIES_PER_MODEL = 2;
const RETRY_DELAY_MS = 1500;
/** שגיאות שווה לנסות שוב (או לעבור בגללן למודל אחר). */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

class GeminiHttpError extends Error {
  constructor(public status: number) {
    super(`Gemini API error ${status}`);
  }
}

/** askGemini עם ניסיונות חוזרים ומעבר בין מודלים. */
async function askGeminiWithFallback(prompt: string): Promise<FunctioningPictureData> {
  let lastError: unknown = null;
  for (const model of GEMINI_FALLBACK_MODELS) {
    for (let t = 1; t <= TRIES_PER_MODEL; t++) {
      try {
        return await askGemini(prompt, model);
      } catch (err) {
        lastError = err;
        const status = err instanceof GeminiHttpError ? err.status : 0;
        // מודל שלא קיים/לא זמין למפתח הזה - ישר למודל הבא
        if (status === 404 || status === 400) break;
        // שגיאה זמנית - ממתינים ומנסים שוב; אחרת (תשובה משובשת) - למודל הבא
        if (!TRANSIENT.has(status)) break;
        if (t < TRIES_PER_MODEL) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * t));
      }
    }
    console.warn(`Gemini model ${model} failed, trying next`);
  }
  throw lastError ?? new Error("Gemini: all models failed");
}

interface TaggedPhrase {
  color: "green" | "red";
  category: string;
  text: string;
}

interface FunctioningPictureData {
  sentence1: string;
  sentence2: string;
}

/** כמה פעמים לבקש ניסוח מחדש אם התשובה הגיעה עם תווים מכתב זר. */
const MAX_ATTEMPTS = 3;

/**
 * כל תו שאינו אות עברית, רווח, ספרה, אות לטינית או סימן פיסוק. NFKC קודם
 * הופך צורות תצוגה עבריות (ﬠ, ﭏ) לאותיות רגילות, כדי שלא ייחשבו זרות.
 */
const FOREIGN_SCRIPT = /[^א-תװ-״\s\p{P}\p{S}0-9A-Za-z]/gu;

/** אות לטינית שצמודה לאות עברית - באמצע מילה עברית ("לקkה"). גם זה פסול. */
const LATIN_IN_HEBREW_WORD = /(?<=[א-תװ-״])[A-Za-z]+|[A-Za-z]+(?=[א-תװ-״])/g;

function hasForeignScript(text: string): boolean {
  const t = text.normalize("NFKC");
  return new RegExp(FOREIGN_SCRIPT.source, "u").test(t) || new RegExp(LATIN_IN_HEBREW_WORD.source).test(t);
}

function stripForeignScript(text: string): string {
  return text
    .normalize("NFKC")
    .replace(FOREIGN_SCRIPT, "")
    .replace(LATIN_IN_HEBREW_WORD, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function askGemini(prompt: string, model: string = GEMINI_MODEL): Promise<FunctioningPictureData> {
  const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            sentence1: { type: "string" },
            sentence2: { type: "string" },
          },
          required: ["sentence1", "sentence2"],
        },
      },
    }),
  });

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    console.error("Gemini API error:", model, geminiResponse.status, errText);
    throw new GeminiHttpError(geminiResponse.status);
  }

  const geminiData = await geminiResponse.json();
  // "output_text" הוא property נוח שמוסיפות ה-SDKs הרשמיות (פייתון/JS) -
  // בקריאת REST גולמית (כמו כאן) הוא לא קיים בפועל בתשובה; הטקסט האמיתי
  // יושב בתוך steps[] (השלב מסוג "model_output").
  const modelOutputStep = (geminiData.steps ?? []).find(
    (step: { type?: string }) => step.type === "model_output",
  );
  const textContent = (modelOutputStep?.content ?? []).find(
    (block: { type?: string }) => block.type === "text",
  );
  const rawText = geminiData.output_text ?? textContent?.text;
  if (!rawText) {
    console.error("Gemini response missing text content:", JSON.stringify(geminiData));
    throw new Error("Gemini response missing text content");
  }
  return JSON.parse(rawText) as FunctioningPictureData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { workshop_id, group_id } = await req.json();
    if (!workshop_id || !group_id) {
      return new Response(JSON.stringify({ error: "workshop_id ו-group_id נדרשים" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    // אותו חישוב "4 ההשראות הכי נבחרות" כמו ב-useTopInspirations בצד הלקוח -
    // כפול בכוונה (לא ייבוא משותף, כי זה קוד Deno נפרד לגמרי מה-build של ה-client).
    const [{ data: textRow }, { data: selectionRows }, { data: markingRow }, { data: workshopRow }] =
      await Promise.all([
        supabase
          .from("responses")
          .select("data")
          .eq("workshop_id", workshop_id)
          .eq("stage_number", 3)
          .eq("type", "inspirations")
          .maybeSingle(),
        supabase
          .from("responses")
          .select("data")
          .eq("workshop_id", workshop_id)
          .eq("stage_number", 3)
          .eq("type", "inspirations_selection"),
        supabase
          .from("responses")
          .select("data")
          .eq("workshop_id", workshop_id)
          .eq("stage_number", 4)
          .eq("type", "text_marking")
          .eq("group_id", group_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from("workshops").select("program_id, dilemma_id").eq("id", workshop_id).maybeSingle(),
      ]);

    // הטקסט המקורי המלא של שלב 4 (לא רק הקטעים שהודגשו ממנו) - כדי שה-AI
    // יראה את ההקשר השלם, לא רק פיסות מבודדות, וייתן ניסוח משמעותי יותר
    // ולא רק שרשור של הביטויים שסומנו. גנרי לגמרי: אם מחר יעלה תוכן אחר
    // לגמרי (תוכנית אחרת, נושא אחר) - זה פשוט מה שיישלף וישמש כהקשר.
    let profileText = "";
    // ספריית הדילמות (2026-11-19): אם נבחרה דילמה להפעלה - הטקסט שלה, לא של תוכן השלב
    const dilemmaId = (workshopRow as { dilemma_id?: string | null } | null)?.dilemma_id;
    if (dilemmaId) {
      const { data: dilemmaRow } = await supabase
        .from("dilemmas")
        .select("profile_text")
        .eq("id", dilemmaId)
        .maybeSingle();
      profileText = (dilemmaRow?.profile_text as string | null) ?? "";
    }
    if (!profileText && workshopRow?.program_id) {
      const { data: stageRow } = await supabase
        .from("program_stages")
        .select("content")
        .eq("program_id", workshopRow.program_id)
        .eq("stage_number", 4)
        .maybeSingle();
      profileText = (stageRow?.content as { profile_text?: string } | null)?.profile_text ?? "";
    }

    const inspirationRows = (textRow?.data as { items?: { text: string }[] } | null)?.items ?? [];
    const counts = new Array(inspirationRows.length).fill(0);
    for (const row of selectionRows ?? []) {
      const selected = (row.data as { selected?: number[] })?.selected ?? [];
      for (const index of selected) {
        if (counts[index] !== undefined) counts[index] += 1;
      }
    }
    const inspirations = counts
      .map((count, index) => ({ index, count, text: inspirationRows[index]?.text ?? "" }))
      .filter((r) => r.text.trim() && r.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 4)
      .map((r) => r.text);

    const phrases = (markingRow?.data as { phrases?: TaggedPhrase[] } | null)?.phrases ?? [];
    const strengths = phrases.filter((p) => p.color === "green");
    const blockers = phrases.filter((p) => p.color === "red");

    const formatPhrases = (list: TaggedPhrase[]) =>
      list.length > 0 ? list.map((p) => `- [${p.category}] ${p.text}`).join("\n") : "(לא סומן דבר)";

    const prompt =
      `את/ה עוזר/ת הוראה מנוסה שמנסח/ת תמונת מצב פדגוגית קצרה, חדה ובעלת משמעות אמיתית ` +
      `בעברית, על סמך כל החומר שקבוצת מורות בסדנה עבדה איתו עד כה. הנושא/התוכן הספציפי ` +
      `עשוי להשתנות מסדנה לסדנה - התבססו רק על מה שמופיע בפועל למטה, לא על הנחות קבועות מראש.\n\n` +
      `הטקסט המקורי שהוצג לקבוצה:\n${profileText || "(לא סופק טקסט)"}\n\n` +
      `השראות שהקבוצות בחרו כחשובות בשלב קודם: ${inspirations.join(", ") || "(לא נבחרו השראות)"}\n\n` +
      `חוזקות שהקבוצה סימנה בטקסט (כל שורה: [הקטגוריה שנבחרה לה] הציטוט המדויק):\n${formatPhrases(strengths)}\n\n` +
      `חסמים/קשיים שהקבוצה סימנה בטקסט (כל שורה: [הקטגוריה שנבחרה לה] הציטוט המדויק):\n${formatPhrases(blockers)}\n\n` +
      `המשימה: לכתוב תמונת מצב כוללת בשני משפטים (sentence1, sentence2) שמשלבת את **כל** ` +
      `החומר למעלה לכדי משמעות אחת מגובשת - לא רשימה, לא שרשור, ולא חזרה מילולית על ` +
      `ציטוטים בודדים. הקטגוריות שצוינו ליד כל חוזקה/חסם הן חלק מהמשמעות עצמה (הן אומרות ` +
      `על *איזה סוג* של דבר מדובר), לא רק תווית טכנית - השתמשו בהן כדי לחדד את הניסוח, לא ` +
      `רק בציטוט הגולמי. המשפטים צריכים להישמע כמו תובנה מקצועית אמיתית של מורה מנוסה, לא ` +
      `כמו רשימת תיוג.\n` +
      `sentence1 - משפט חד ומשמעותי שמשקף את היכולות והחוזקות שעולות מהתמונה הכוללת (כולל ההשראות).\n` +
      `sentence2 - משפט חד ומשמעותי שמשקף את הקושי/החסם המרכזי שעולה מהתמונה הכוללת.\n` +
      `הישארו נאמנים לרוח החומר שקיבלתם - בלי להמציא עובדות חדשות שלא נרמזות ממנו. ` +
      `התאימו את השפה וההתייחסות (למשל אם מדובר בתלמיד/ה, בכיתה, או בגורם אחר לגמרי) למה שבאמת ` +
      `עולה מהטקסט המקורי, לא להנחה קבועה מראש. כתבו בעברית תקנית, בגוף שלישי.\n` +
      `השתמשו באותיות עבריות בלבד (וסימני פיסוק רגילים) - בלי אף תו מכתב אחר, בלי אימוג'י, ` +
      `ובלי ניקוד. כל מילה חייבת להיות מילה עברית שלמה.`;

    // Gemini "גולש" לפעמים באמצע מילה לכתב אחר - נתפס בפועל: "להצלחה" יצא
    // "להצ" + אותיות קנאדה. תשובה כזו לא נשמרת: מבקשים ניסוח חדש, ורק אם
    // גם הניסיון האחרון משובש - מסירים את התווים הזרים.
    let result: FunctioningPictureData | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const candidate = await askGeminiWithFallback(prompt);
      if (!hasForeignScript(candidate.sentence1) && !hasForeignScript(candidate.sentence2)) {
        result = candidate;
        break;
      }
      console.warn(`Gemini returned foreign script (attempt ${attempt}):`, JSON.stringify(candidate));
      if (attempt === MAX_ATTEMPTS) {
        result = { sentence1: stripForeignScript(candidate.sentence1), sentence2: stripForeignScript(candidate.sentence2) };
      }
    }
    if (!result) throw new Error("Gemini returned no result");

    await supabase.from("responses").insert({
      workshop_id,
      group_id,
      stage_number: 4,
      type: "functioning_picture",
      data: result,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "שגיאה בייצור תמונת התפקוד" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
