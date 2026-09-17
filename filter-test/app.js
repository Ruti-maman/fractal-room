const rowsEl = document.getElementById("rows");
const uaBox = document.getElementById("ua-box");

const checks = [];

function addCheck(id, title) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div class="status pending" id="status-${id}">⏳</div>
    <div class="info">
      <div class="title">${title}</div>
      <div class="detail" id="detail-${id}"></div>
    </div>
  `;
  rowsEl.appendChild(row);
  checks.push(id);
  return row;
}

function setStatus(id, ok, detail) {
  const statusEl = document.getElementById(`status-${id}`);
  const detailEl = document.getElementById(`detail-${id}`);
  statusEl.className = "status " + (ok ? "ok" : "fail");
  statusEl.textContent = ok ? "✅" : "❌";
  if (detail) detailEl.textContent = detail;
}

function addButtonCheck(id, title, buttonLabel, onClick) {
  const row = addCheck(id, title);
  const btn = document.createElement("button");
  btn.textContent = buttonLabel;
  btn.onclick = onClick;
  row.appendChild(btn);
  return row;
}

// 1. טעינת האתר - אם הגענו לכאן, זה כבר עבר
addCheck("load", "טעינת האתר");
setStatus("load", true, `נטען בהצלחה בשעה ${new Date().toLocaleTimeString("he-IL")}`);

// 2. חיבור ל-Supabase (REST API)
addCheck("supabase", "חיבור ל-Supabase (REST API)");
fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: SUPABASE_ANON_KEY },
})
  .then((res) => {
    // כל תגובה מהשרת (גם 401/404) מוכיחה שהדומיין לא חסום ברשת - וזו מטרת הבדיקה כאן.
    setStatus("supabase", true, `השרת הגיב (סטטוס ${res.status}) - הדומיין אינו חסום`);
  })
  .catch((err) => {
    setStatus("supabase", false, `לא התקבלה תגובה משרת: ${err.message} - ייתכן שהדומיין חסום`);
  });

// 3. WebSocket בזמן אמת (Realtime)
addCheck("realtime", "חיבור Realtime (WebSocket)");
(function testRealtime() {
  const wsUrl = SUPABASE_URL.replace("https://", "wss://") +
    `/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
  let settled = false;
  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      setStatus("realtime", false, "פסק זמן (10 שניות) - ייתכן שה-WebSocket חסום");
    }
  }, 10000);
  try {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      setStatus("realtime", true, "החיבור נפתח בהצלחה");
      ws.close();
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      setStatus("realtime", false, "שגיאת חיבור - ייתכן שה-WebSocket חסום ברשת");
    };
  } catch (err) {
    settled = true;
    clearTimeout(timeout);
    setStatus("realtime", false, `שגיאה: ${err.message}`);
  }
})();

// 4. השמעת צליל (נוצר בקוד, בלי קובץ חיצוני)
addButtonCheck("sound", "השמעת צליל", "נגני צליל", () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setStatus("sound", true, "אם שמעת צפצוף - תקין");
  } catch (err) {
    setStatus("sound", false, `שגיאה: ${err.message}`);
  }
});

// 5. מסך מלא
addButtonCheck("fullscreen", "מסך מלא (Fullscreen)", "היכנסי למסך מלא", async () => {
  try {
    await document.documentElement.requestFullscreen();
    setStatus("fullscreen", true, "נכנס למסך מלא בהצלחה");
  } catch (err) {
    setStatus("fullscreen", false, `שגיאה: ${err.message}`);
  }
});

// 6. Wake Lock
addButtonCheck("wakelock", "Wake Lock (מניעת כיבוי מסך)", "בקשי Wake Lock", async () => {
  try {
    if (!("wakeLock" in navigator)) {
      setStatus("wakelock", false, "ה-API לא נתמך בדפדפן הזה");
      return;
    }
    const lock = await navigator.wakeLock.request("screen");
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setStatus("wakelock", true, `Wake Lock פעיל כבר ${seconds} שניות - אם המספר ממשיך לעלות והמסך דלוק, זה עובד`);
    }, 1000);
    lock.addEventListener("release", () => {
      clearInterval(tick);
      setStatus("wakelock", false, "ה-Wake Lock שוחרר (למשל אם עברת ללשונית אחרת)");
    });
  } catch (err) {
    setStatus("wakelock", false, `שגיאה: ${err.message}`);
  }
});

// 7. מצלמה
addButtonCheck("camera", "גישה למצלמה", "בקשי הרשאת מצלמה", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    setStatus("camera", true, "התקבלה גישה למצלמה");
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    setStatus("camera", false, `שגיאה: ${err.message}`);
  }
});

// 8. גרסת דפדפן ו-user agent
addCheck("ua", "גרסת דפדפן ו-User Agent");
setStatus("ua", true, "ראו פירוט למטה");
uaBox.textContent = navigator.userAgent;
