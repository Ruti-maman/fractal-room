import type { Stage1Content } from "../../types/stage1Content";
import { requestKioskPermissions } from "../../hooks/useKioskMode";
import { useState } from "react";
import { primeAudio } from "../../lib/audioUnlock";
import AutoPlayVideo from "../AutoPlayVideo";

interface Props {
  screenNumber: number;
  content: Stage1Content;
  onAdvance: () => void;
}

/** צליל מעבר זמני (עד שיגיע קובץ סאונד אמיתי מהלקוחה) - נוצר בקוד, בלי קובץ חיצוני. */
function playTransitionSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // אם Web Audio לא נתמך - פשוט בלי צליל, לא עוצרים את הזרימה.
  }
}

function ScreenContent({ screen }: { screen: Stage1Content["screens"][string] | undefined }) {
  if (!screen) {
    return <p className="text-white/50">אין תוכן מוגדר למסך הזה בשלב 1.</p>;
  }
  if (screen.type === "logo") {
    return screen.image_url ? (
      <img src={screen.image_url} alt="לוגו חדר פרקטל" className="max-h-64" />
    ) : (
      <div className="flex h-48 w-64 items-center justify-center rounded-xl bg-white/10 text-white/50">
        לוגו יתווסף כאן
      </div>
    );
  }
  if (screen.type === "video") {
    return screen.video_url ? (
      <AutoPlayVideo src={screen.video_url} className="max-h-[62vh] rounded-2xl" />
    ) : (
      <div className="flex h-48 w-80 items-center justify-center rounded-xl bg-white/10 text-white/50">
        כאן יופיע סרטון
      </div>
    );
  }
  return (
    <div className="max-w-xl text-center">
      <h2 className="mb-3 text-2xl font-bold">{screen.title}</h2>
      <p className="text-lg">{screen.body}</p>
    </div>
  );
}

function Stage1Opening({ screenNumber, content }: Props) {
  const [started, setStarted] = useState(false);
  const screen = content.screens[String(screenNumber)];

  function handleStart() {
    primeAudio();
    requestKioskPermissions();
    playTransitionSound();
    // הכפתור **לא** מעביר שלב: לפי תשובת הלקוחה הטיימר הוא זה שמעביר.
    // תפקידו היחיד הוא לפתוח את הרשאת הקול ואת מצב הקיוסק בנגיעה אמיתית.
    setStarted(true);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <ScreenContent screen={screen} />

      {started ? (
        <p className="text-lg font-bold text-white/50">הסדנה מתחילה...</p>
      ) : (
        <button
          className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-2xl font-bold transition-transform duration-100 active:scale-90"
          onClick={handleStart}
        >
          התחילו
        </button>
      )}
    </main>
  );
}

export default Stage1Opening;
