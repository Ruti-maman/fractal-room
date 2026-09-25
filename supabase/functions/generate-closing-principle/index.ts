// Edge Function: מנסחת את **משפט הסיום** של הסדנה - משפט אחד, חזק ורציני,
// שמסכם את כל מה שהקבוצות יצרו לאורך עשרת השלבים (שקף 15 במצגת).
//
// למה בשרת: המפתח של Gemini נשאר כאן ולא מגיע למסך שבחדר, והקריאה ל-Google
// יוצאת מהשרת של סופאבייס - כך לא נוסף דומיין שהסינון צריך לאשר (סעיף 2
// ו-9 ב-CLAUDE.md). אותו ספק ומודל כמו שאר ה-AI בפרויקט.
//
// המשפט נשמר ב-responses (type "closing_principle") כשורה אחת משותפת לכל
// ההפעלה, ולכן שלושת המסכים מציגים **בדיוק את אותו משפט**. אם כבר נוסח -
// מחזירים את הקיים ולא מייצרים חדש, גם אם שלושת המסכים ביקשו במקביל.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-3.5-flash-lite";

interface ResponseRow {
  group_id: string | null;
  stage_number: number;
  type: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // group_id נדרש רק כי העמודה ב-responses היא not null; המשפט עצמו משותף
    // לכל ההפעלה ונקרא לפי workshop_id בלבד, בלי קשר לקבוצה ששלחה את הבקשה.
    const { workshop_id, group_id } = await req.json();
    if (!workshop_id || !group_id) {
      return new Response(JSON.stringify({ error: "workshop_id ו-group_id נדרשים" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // כבר נוסח? מחזירים אותו. זה מה שמונע שלושה משפטים שונים בשלושה מסכים.
    const { data: existing } = await supabase
      .from("responses")
      .select("data")
      .eq("workshop_id", workshop_id)
      .eq("stage_number", 10)
      .eq("type", "closing_principle")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (existing?.data) {
      return new Response(JSON.stringify(existing.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // כל מה שנצבר בסדנה
    const { data: rows } = await supabase
      .from("responses")
      .select("group_id, stage_number, type, data")
      .eq("workshop_id", workshop_id);
    const responses = (rows ?? []) as ResponseRow[];

    const pick = (type: string) => responses.filter((r) => r.type === type);
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    // שלב 3 - ההשראות המשותפות
    const inspirations = new Set<string>();
    for (const row of [...pick("inspirations"), ...pick("inspirations_selection")]) {
      const list = (row.data?.inspirations ?? row.data?.selected ?? row.data?.items) as unknown;
      if (Array.isArray(list)) {
        for (const item of list) {
          const value = typeof item === "string" ? item : text((item as { text?: string })?.text);
          if (value) inspirations.add(value);
        }
      }
    }

    // שלב 4 - ביטויים שסומנו, תמונת התפקוד והמסקנה המעשית שהקבוצות הקלידו
    const phrases: string[] = [];
    for (const row of pick("text_marking")) {
      const list = (row.data?.phrases ?? row.data?.marks) as unknown;
      if (Array.isArray(list)) {
        for (const item of list) {
          const value = text((item as { text?: string })?.text);
          const category = text((item as { category?: string })?.category);
          if (value) phrases.push(category ? `${value} (${category})` : value);
        }
      }
    }

    const pictures: string[] = [];
    const conclusions: string[] = [];
    for (const row of pick("functioning_picture")) {
      const s1 = text(row.data?.sentence1);
      const s2 = text(row.data?.sentence2);
      const conclusion = text(row.data?.group_conclusion);
      if (s1) pictures.push(s1);
      if (s2) pictures.push(s2);
      if (conclusion) conclusions.push(conclusion);
    }

    // שלב 7 - הפתרונות שהוקלדו ותמלול ההקלטות
    const solutions = pick("solution_text").map((r) => text(r.data?.text)).filter(Boolean);
    const spoken: string[] = [];
    for (const row of pick("clip_transcript")) {
      const segments = row.data?.segments as { text?: string }[] | undefined;
      if (Array.isArray(segments)) {
        const joined = segments.map((s) => text(s.text)).filter(Boolean).join(" ");
        if (joined) spoken.push(joined);
      }
    }

    const context = [
      inspirations.size > 0 ? `מילות ההשראה שנבחרו: ${[...inspirations].join(", ")}` : "",
      phrases.length > 0 ? `ביטויים שסומנו בדילמה: ${phrases.slice(0, 30).join(" | ")}` : "",
      pictures.length > 0 ? `תמונת התפקוד שנוסחה: ${pictures.join(" ")}` : "",
      conclusions.length > 0 ? `המסקנות המעשיות שהקבוצות כתבו: ${conclusions.join(" | ")}` : "",
      solutions.length > 0 ? `הפתרונות שהוצעו לסימולציה: ${solutions.join(" | ")}` : "",
      spoken.length > 0 ? `מתוך הסימולציות שהוקלטו: ${spoken.join(" | ").slice(0, 1200)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (context.trim() === "") {
      return new Response(JSON.stringify({ error: "אין עדיין תוכן מהסדנה לנסח ממנו" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "חסר GEMINI_API_KEY בהגדרות הפרויקט" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buildPrompt = (stricter: boolean) =>
      [
        "קבוצות של מורות השתתפו בסדנה פדגוגית. להלן **כל** מה שהן עצמן כתבו ואמרו במהלכה:",
        "",
        context,
        "",
        "נסח משפט סיום אחד לסדנה כולה - המסר שאיתו הן יוצאות מהיום הזה.",
        "",
        "כללים מחייבים:",
        "- הסתמך **אך ורק** על החומר שלמעלה. אסור להמציא עובדות, שמות או אירועים",
        "  שלא מופיעים בו. אם החומר דל - נסח משפט כללי יותר, אבל אל תמציא.",
        "- המשפט חייב להיות **מסר מעשי**: משהו שמורה יכולה לקחת איתה ולעשות איתו",
        "  משהו כבר מחר בכיתה - לא תיאור של מה שקרה בסדנה ולא הכרזה על סיומה.",
        "- משפט אחד בלבד, עד 25 מילים, עברית תקנית ומדויקת.",
        "- לשון רבים, פונה למשתתפות.",
        "- רציני ומכובד. בלי סימני קריאה, בלי סיסמאות שיווקיות, בלי מליצות.",
        "- אסורות המילים: מדהים, מרגש, כל הכבוד, מסע, קסם, מסחרר.",
        "- שהמסר ינבע ממה שהן עצמן אמרו, ולא יהיה אמירה שמתאימה לכל סדנה בעולם.",
        stricter
          ? "- הניסוח הקודם נפסל. כתוב משפט קצר, מדויק ומעשי יותר, בלי קישוט לשוני."
          : "",
        "",
        'החזר אך ורק JSON תקין במבנה: {"sentence":"..."}',
      ]
        .filter(Boolean)
        .join("\n");

    /** בדיקת איכות בסיסית - מה שלא עובר אותה נשלח לניסוח חוזר. */
    const isAcceptable = (candidate: string) => {
      if (!candidate) return false;
      if (candidate.length > 220) return false;
      if (candidate.includes("!")) return false;
      // יותר ממשפט אחד: סימן סיום באמצע ואחריו עוד טקסט
      if (/[.!?]\s+\S/.test(candidate)) return false;
      const banned = ["מדהים", "מרגש", "כל הכבוד", "קסם", "מסחרר"];
      return !banned.some((word) => candidate.includes(word));
    };

    async function askGemini(stricter: boolean): Promise<string> {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(stricter) }] }],
            // טמפרטורה נמוכה בכוונה: רוצים ניסוח נאמן לחומר, לא יצירתיות
            generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
          }),
        },
      );
      if (!res.ok) throw new Error((await res.text()).slice(0, 300));
      const json = await res.json();
      const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      try {
        return String(JSON.parse(raw)?.sentence ?? "").trim();
      } catch {
        return "";
      }
    }

    let sentence = "";
    try {
      sentence = await askGemini(false);
      // ניסיון שני אם המשפט לא עומד בכללים (ארוך מדי, כמה משפטים, מליצה)
      if (!isAcceptable(sentence)) {
        const second = await askGemini(true);
        if (isAcceptable(second)) sentence = second;
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: `Gemini החזירה שגיאה: ${String(err)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ניקוי אחרון: מרכאות עוטפות וסימני קריאה שהמודל הוסיף בכל זאת
    sentence = sentence.replace(/^["'\u05f4\u201c\u201d]+|["'\u05f4\u201c\u201d]+$/g, "").replace(/!+/g, "").trim();

    if (!sentence) {
      return new Response(JSON.stringify({ error: "המודל לא החזיר משפט" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = { sentence };

    // בדיקה אחרונה לפני הכתיבה: אם מסך אחר הספיק לשמור בינתיים, לא כותבים
    // שורה שנייה - אחרת שני מסכים יציגו משפטים שונים.
    const { data: raceCheck } = await supabase
      .from("responses")
      .select("data")
      .eq("workshop_id", workshop_id)
      .eq("stage_number", 10)
      .eq("type", "closing_principle")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (raceCheck?.data) {
      return new Response(JSON.stringify(raceCheck.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("responses").insert({
      workshop_id,
      group_id,
      stage_number: 10,
      type: "closing_principle",
      data: payload,
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
