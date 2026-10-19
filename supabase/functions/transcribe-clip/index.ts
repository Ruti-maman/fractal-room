// Edge Function: מתמללת הקלטת סימולציה של שלב 7 ומחזירה כתוביות מתוזמנות.
//
// למה בשרת ולא במסך: תמלול בדפדפן (Web Speech API) שולח את הקול לשרתי Google
// ישירות מהמסך שבחדר - כלומר דומיין חדש שהסינון יחסום, ובאנדרואיד ישן הוא
// בכלל לא נתמך. כאן הקריאה יוצאת מהשרת של סופאבייס, בדיוק כמו
// generate-functioning-picture, ולכן לא מוסיפה שום דומיין לרשימה בסעיף 9.
//
// אותו ספק ואותו מודל כמו שאר ה-AI בפרויקט - Gemini (ראו ההסבר המלא
// ב-generate-functioning-picture/index.ts). אם צריך להחליף מודל, כאן בלבד.
//
// התוצאה נשמרת ב-responses (type "clip_transcript") כדי שכל המסכים יראו את
// אותן כתוביות, והתמלול ירוץ פעם אחת בלבד לכל הקלטה.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-3.5-flash-lite";

interface Segment {
  start: number; // שניות מתחילת הסרטון
  end: number;
  text: string;
}

/** "1.5", 1.5, "00:01.5", "0:01" - כל הצורות שהמודל החזיר בפועל לזמן. */
function toSeconds(value: unknown): number {
  if (typeof value === "number") return value;
  const s = String(value ?? "").trim();
  if (s.includes(":")) {
    return s.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
  }
  return Number(s);
}

/** ממיר את מה שהמודל החזיר למבנה בטוח, גם אם חלק מהשדות חסרים או הפוכים. */
function normalize(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  const out: Segment[] = [];
  for (const item of raw) {
    const it = item as Record<string, unknown>;
    const text = String(it?.text ?? it?.transcript ?? "").trim();
    if (!text) continue;
    const start = toSeconds(it?.start ?? it?.start_time ?? 0);
    const end = toSeconds(it?.end ?? it?.end_time ?? start + 3);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({ start: Math.max(0, start), end: Math.max(start + 0.5, end), text });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * מחלץ את הקטעים מהטקסט שהמודל החזיר. נתפס בפועל שהתשובה הגיעה לפעמים
 * עטופה ב-```json, או כמערך ישיר בלי {"segments": ...} - ואז JSON.parse
 * נכשל או ש-segments היה undefined, ונשמר תמלול ריק.
 */
function parseSegments(rawText: string): Segment[] {
  const cleaned = rawText.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return normalize(Array.isArray(parsed) ? parsed : parsed?.segments);
  } catch {
    return [];
  }
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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // אם כבר תומלל - מחזירים את מה שיש, בלי לבזבז קריאה ל-AI. **תמלול ריק
    // לא נחשב**: קודם שורה עם segments ריק "נעלה" את הקבוצה לתמיד בלי
    // כתוביות, כי היא נחשבה כאילו כבר תומללה.
    const { data: existingRows } = await supabase
      .from("responses")
      .select("id, data")
      .eq("workshop_id", workshop_id)
      .eq("group_id", group_id)
      .eq("stage_number", 7)
      .eq("type", "clip_transcript")
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = existingRows?.[0];
    const existingSegments = (existing?.data as { segments?: Segment[] } | undefined)?.segments ?? [];
    if (existing && existingSegments.length > 0) {
      return new Response(JSON.stringify(existing.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ההקלטה עצמה - נשלפת מה-Storage בצד השרת, שם אין סינון
    const { data: mediaRow } = await supabase
      .from("media")
      .select("url")
      .eq("workshop_id", workshop_id)
      .eq("group_id", group_id)
      .eq("stage_number", 7)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!mediaRow?.url) {
      return new Response(JSON.stringify({ error: "לא נמצאה הקלטה לקבוצה הזו" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clipRes = await fetch(mediaRow.url);
    if (!clipRes.ok) {
      return new Response(JSON.stringify({ error: `הורדת ההקלטה נכשלה (${clipRes.status})` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bytes = new Uint8Array(await clipRes.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "חסר GEMINI_API_KEY בהגדרות הפרויקט" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = [
      "תמלל את הדיבור בהקלטה הזו לעברית.",
      "החזר אך ורק JSON תקין במבנה:",
      '{"segments":[{"start":0.0,"end":2.5,"text":"..."}]}',
      "כל קטע הוא משפט או חלק ממשפט, באורך של 2-4 שניות לכל היותר,",
      "כדי שאפשר יהיה להציג אותו ככתובית אחת קריאה.",
      "start ו-end הם שניות מתחילת ההקלטה.",
      "אם אין דיבור בהקלטה, החזר segments ריק.",
      "אל תוסיף הסברים, כותרות או סימוני קוד - רק ה-JSON עצמו.",
    ].join("\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "video/webm", data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Gemini החזירה שגיאה: ${detail.slice(0, 300)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiJson = await geminiRes.json();
    // כל חלקי הטקסט, לא רק הראשון - המודל מפצל לפעמים את התשובה לכמה parts
    const rawText: string = (geminiJson?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    const segments = parseSegments(rawText || "{}");

    const payload = { segments };
    if (segments.length === 0) {
      // לא שומרים ריק - כך הבקשה הבאה (מסך הצפייה מבקש שוב) תנסה מחדש.
      // התשובה הגולמית ביומן של הפונקציה, כדי שיהיה אפשר לראות מה חזר.
      console.warn("transcribe-clip: no segments parsed. raw:", rawText.slice(0, 500));
    } else if (existing) {
      // הייתה שורה ריקה מלפני התיקון - מעדכנים אותה במקום להוסיף כפולה
      await supabase.from("responses").update({ data: payload }).eq("id", existing.id);
    } else {
      await supabase.from("responses").insert({
        workshop_id,
        group_id,
        stage_number: 7,
        type: "clip_transcript",
        data: payload,
      });
    }

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
