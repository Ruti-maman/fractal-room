import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * שמירת הקלטות שלב 7 **כקבצים בתוך הפרויקט** (public/recordings), ולא רק בענן.
 *
 * למה: הסינון (NetFree) חוסם הורדת קובצי וידאו מהדומיין של סופאבייס - חסימת
 * קטגוריה, גם webm וגם mp4 (נבדק ב-2026-09-23, ראו סעיף 9 ב-CLAUDE.md). לכן
 * הקלטה שנשמרה בענן לא ניתנת לצפייה חזרה מתוך החדר. קובץ שיושב בתוך הפרויקט
 * נטען מהמחשב עצמו (localhost), לא עובר באינטרנט, ולכן אין מה לחסום.
 *
 * יתרון נוסף שביקשה הלקוחה: העתקת תיקיית הפרויקט לדיסק-און-קי מעבירה איתה גם
 * את ההקלטות, וכל מי שמריץ את הפרויקט במחשב אחר רואה אותן - בדיוק כמו שאר
 * האפליקציה, ברמה מקומית.
 *
 * הנקודה שחשוב להכיר: התוסף רץ רק בשרת הפיתוח (apply: "serve"). באתר שעולה
 * לענן אין endpoint כזה, והקוד בצד הלקוח פשוט נופל בחזרה לכתובת של סופאבייס.
 */

const SAFE_ID = /^[a-zA-Z0-9-]{1,64}$/; // מזהי UUID בלבד - מונע מעבר תיקיות

function clipPath(root: string, workshopId: string, groupId: string) {
  return path.join(root, "public", "recordings", workshopId, `${groupId}.webm`);
}

export default function localClips(): Plugin {
  return {
    name: "local-clips",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;

      server.middlewares.use("/__clips", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const workshopId = url.searchParams.get("workshop") ?? "";
        const groupId = url.searchParams.get("group") ?? "";
        const json = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (!SAFE_ID.test(workshopId) || (groupId !== "" && !SAFE_ID.test(groupId))) {
          return json(400, { error: "bad id" });
        }

        // רשימת ההקלטות שכבר קיימות כקבצים בהפעלה הזו
        if (url.pathname.startsWith("/list")) {
          const dir = path.join(root, "public", "recordings", workshopId);
          const groups = fs.existsSync(dir)
            ? fs.readdirSync(dir).filter((f) => f.endsWith(".webm")).map((f) => f.replace(/\.webm$/, ""))
            : [];
          return json(200, { groups });
        }

        // שמירת הקלטה
        if (url.pathname.startsWith("/save") && req.method === "POST") {
          if (!SAFE_ID.test(groupId)) return json(400, { error: "bad group" });
          const target = clipPath(root, workshopId, groupId);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => {
            try {
              fs.writeFileSync(target, Buffer.concat(chunks));
              json(200, { url: `/recordings/${workshopId}/${groupId}.webm` });
            } catch (err) {
              json(500, { error: String(err) });
            }
          });
          return;
        }

        json(404, { error: "not found" });
      });
    },
  };
}
