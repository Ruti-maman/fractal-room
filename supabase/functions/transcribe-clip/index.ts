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

/** ממיר את מה שהמודל החזיר למבנה בטוח, גם אם חלק מהשדות חסרים או הפוכים. */
function normalize(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  const out: Segment[] = [];
  for (const item of raw) {
    const text = String((item as Segment)?.text ?? "").trim();
    if (!text) continue;
    const start = Number((item as Segment)?.start ?? 0);
    const end = Number((item as Segment)?.end ?? start + 3);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({ start: Math.max(0, start), end: Math.max(start + 0.5, end), text });
  }
  return out.sort((a, b) => a.start - b.start);
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

    // אם כבר תומלל - מחזירים את מה שיש, בלי לבזבז קריאה ל-AI
    const { data: existing } = await supabase
      .from("responses")
      .select("data")
      .eq("workshop_id", workshop_id)
      .eq("group_id", group_id)
      .eq("stage_number", 7)
      .eq("type", "clip_transcript")
      .maybeSingle();
    if (existing?.data) {
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
    const rawText: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let segments: Segment[] = [];
    try {
      segments = normalize(JSON.parse(rawText)?.segments);
    } catch {
      segments = [];
    }

    const payload = { segments };
    await supabase.from("responses").insert({
      workshop_id,
      group_id,
      stage_number: 7,
      type: "clip_transcript",
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
