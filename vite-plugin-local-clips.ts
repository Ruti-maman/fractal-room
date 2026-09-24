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

// ההקלטות יושבות ב-<שורש הפרויקט>/recordings ו**לא** בתוך public. הסיבה:
// כל מה שב-public מועתק אוטומטית ל-dist בזמן בנייה, כלומר הקלטות של
// משתתפות היו נארזות לאתר שעולה לענן - גם בעיית פרטיות וגם משקל מיותר.
// התוסף מגיש אותן בעצמו בכתובת /recordings, ולכן המיקום בדיסק לא משנה לדפדפן.
const CLIPS_DIR = "recordings";

function clipsBase(root: string) {
  return path.join(root, CLIPS_DIR);
}

function clipPath(root: string, workshopId: string, groupId: string) {
  return path.join(clipsBase(root), workshopId, `${groupId}.webm`);
}

export default function localClips(): Plugin {
  return {
    name: "local-clips",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;

      // הגשת ההקלטות. לא מסתמכים על ההגשה האוטומטית של public/: היא נקבעת
      // כשהשרת עולה, ולכן קובץ שנוצר **תוך כדי** ריצה לא נמצא - ובמקומו
      // מוחזר index.html (ה-fallback של אפליקציית העמוד היחיד). ה-<video>
      // מקבל אז HTML במקום וידאו ונכשל בשקט. כאן הקובץ נקרא מהדיסק בכל
      // בקשה, כך שהקלטה שזה עתה נשמרה מתנגנת מיד.
      server.middlewares.use("/recordings", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "").split("?")[0]);
        const parts = rel.split("/").filter(Boolean);
        if (parts.length !== 2 || !parts[1].endsWith(".webm")) return next();

        const workshopId = parts[0];
        const groupId = parts[1].replace(/\.webm$/, "");
        if (!SAFE_ID.test(workshopId) || !SAFE_ID.test(groupId)) return next();

        const file = clipPath(root, workshopId, groupId);
        if (!fs.existsSync(file)) return next();

        const { size } = fs.statSync(file);
        const range = req.headers.range;
        res.setHeader("Content-Type", "video/webm");
        res.setHeader("Accept-Ranges", "bytes");

        // חשוב: סוגרים את הזרם כשהבקשה נקטעת. דפדפן שמדלג בתוך סרטון או
        // עוזב את הדף קוטע בקשות באמצע, וזרם שנשאר פתוח משאיר **נעילה** על
        // הקובץ בווינדוס - ואז "סדנה חדשה" לא מצליחה למחוק את ההקלטות הישנות.
        function send(options?: { start: number; end: number }) {
          const stream = options ? fs.createReadStream(file, options) : fs.createReadStream(file);
          const close = () => stream.destroy();
          res.on("close", close);
          res.on("error", close);
          req.on("aborted", close);
          stream.on("error", () => res.end());
          stream.pipe(res);
        }

        // תמיכה ב-Range כדי שאפשר יהיה לדלג בתוך הסרטון בזמן הצפייה
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          const start = match && match[1] ? parseInt(match[1], 10) : 0;
          const end = match && match[2] ? parseInt(match[2], 10) : size - 1;
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
          res.setHeader("Content-Length", end - start + 1);
          send({ start, end });
          return;
        }

        res.setHeader("Content-Length", size);
        send();
      });

      server.middlewares.use("/__clips", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const workshopId = url.searchParams.get("workshop") ?? "";
        const groupId = url.searchParams.get("group") ?? "";
        const json = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        // ניקוי הקלטות של הפעלות קודמות. נקרא מ"סדנה חדשה", שמוחקת גם את
        // הנתונים במסד - כדי שלא יישארו על הדיסק קבצים יתומים.
        if (url.pathname.startsWith("/cleanup")) {
          const keep = url.searchParams.get("keep") ?? "";
          const base = clipsBase(root);
          let removed = 0;
          const failed: string[] = [];
          if (fs.existsSync(base)) {
            for (const dir of fs.readdirSync(base)) {
              if (dir === keep || !SAFE_ID.test(dir)) continue;
              // ב-Windows קובץ שזה עתה נוגן עדיין נעול לרגע, ואז rmSync נופל
              // ב-ENOTEMPTY. מוחקים קודם את הקבצים אחד-אחד, ואז את התיקייה,
              // עם כמה ניסיונות חוזרים - ושגיאה בתיקייה אחת לא מפילה את השאר.
              const full = path.join(base, dir);
              try {
                for (const file of fs.readdirSync(full)) {
                  fs.rmSync(path.join(full, file), { force: true, maxRetries: 5, retryDelay: 120 });
                }
                fs.rmSync(full, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
                removed++;
              } catch {
                failed.push(dir);
              }
            }
          }
          // תיקייה שקובץ בתוכה עדיין נעול (הדפדפן זה עתה ניגן אותו) לא תימחק
          // עכשיו. ווינדוס משחרר את הנעילה תוך שניות, ולכן מנסים שוב ברקע -
          // אחרת נשארים קבצים יתומים אחרי כל "סדנה חדשה".
          for (const delay of [2000, 6000, 15000]) {
            if (failed.length === 0) break;
            setTimeout(() => {
              for (const dir of failed) {
                const full = path.join(base, dir);
                if (!fs.existsSync(full)) continue;
                try {
                  fs.rmSync(full, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
                } catch {
                  // ננסה שוב בסבב הבא / באיפוס הבא
                }
              }
            }, delay);
          }

          // ניקוי גם של המיקום הישן (public/recordings) מגרסאות קודמות
          const legacy = path.join(root, "public", CLIPS_DIR);
          if (fs.existsSync(legacy)) {
            try {
              fs.rmSync(legacy, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
            } catch {
              // נעול כרגע - ינוקה בהזדמנות הבאה
            }
          }

          return json(200, { removed, failed });
        }

        if (!SAFE_ID.test(workshopId) || (groupId !== "" && !SAFE_ID.test(groupId))) {
          return json(400, { error: "bad id" });
        }

        // רשימת ההקלטות שכבר קיימות כקבצים בהפעלה הזו
        if (url.pathname.startsWith("/list")) {
          const dir = path.join(clipsBase(root), workshopId);
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
