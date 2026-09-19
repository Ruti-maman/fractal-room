import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMedia } from "../../hooks/useMedia";
import { useRatings } from "../../hooks/useRatings";
import type { Group } from "../../types/group";

const RECORD_SECONDS = 10;

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

function SolutionAndRecord({
  workshopId,
  myGroup,
  onDone,
}: {
  workshopId: string;
  myGroup: Group;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"solution" | "record">("solution");
  const [solution, setSolution] = useState("");
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase !== "record") return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        setStatus("error");
        setError("אין גישה למצלמה: " + err.message);
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [phase]);

  async function handleSaveSolution() {
    await supabase
      .from("responses")
      .insert({
        workshop_id: workshopId,
        group_id: myGroup.id,
        stage_number: 7,
        type: "solution_text",
        data: { text: solution },
      })
      .then();
    setPhase("record");
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = handleUpload;
    recorder.start();
    recorderRef.current = recorder;
    setStatus("recording");
    setSecondsLeft(RECORD_SECONDS);

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          recorder.stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleUpload() {
    setStatus("uploading");
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const path = `${workshopId}/${myGroup.id}-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from("media").upload(path, blob);
    if (uploadError) {
      setStatus("error");
      setError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    await supabase
      .from("media")
      .insert({
        workshop_id: workshopId,
        group_id: myGroup.id,
        stage_number: 7,
        url: urlData.publicUrl,
      })
      .then();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onDone();
  }

  if (phase === "solution") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-2xl font-bold">הקלידי את הפתרון שהקבוצה גיבשה</h1>
        <textarea
          className="h-32 w-96 rounded-xl bg-white/10 p-4 outline-none"
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
        />
        <button
          className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold active:scale-90 disabled:opacity-50"
          onClick={handleSaveSolution}
          disabled={!solution.trim()}
        >
          הבא
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">היכונו להקלטה מול המצלמה</h1>
      <p className="text-white/70">משתתפת אחת תעמוד מול המצלמה ותסריט את עצמה עושה את הפתרון.</p>

      {error && <p className="text-accent-red">{error}</p>}

      <video ref={videoRef} autoPlay muted className="h-64 w-80 rounded-xl bg-black object-cover" />

      {status === "idle" && (
        <button
          className="bg-accent-red rounded-xl px-10 py-5 text-xl font-bold active:scale-90"
          onClick={startRecording}
        >
          התחילי הקלטה ({RECORD_SECONDS} שניות)
        </button>
      )}
      {status === "recording" && (
        <p className="text-accent-red text-2xl font-bold">🔴 מקליטה... {secondsLeft}</p>
      )}
      {status === "uploading" && <p className="text-xl">מעלה את ההקלטה...</p>}
    </main>
  );
}

function SharedViewing({
  workshopId,
  myGroup,
  allGroups,
  onAdvance,
}: {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}) {
  const media = useMedia(workshopId, 7);
  const { myRatings, rate } = useRatings(workshopId, myGroup.id);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">צפייה משותפת בכל ההסרטות</h1>

      <div className="flex flex-wrap justify-center gap-6">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g) => {
            const clip = media.find((m) => m.group_id === g.id);
            const myStars = myRatings[g.id] ?? 0;
            return (
              <div key={g.id} className="w-64 rounded-xl bg-white/10 p-4">
                <div className="mb-2 font-bold">{g.name ?? `מסך ${g.screen_number}`}</div>
                {clip ? (
                  <video src={clip.url} controls className="h-40 w-full rounded-lg bg-black" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg bg-black/40 text-sm text-white/50">
                    עדיין מקליטה...
                  </div>
                )}
                <div className="mt-2 flex justify-center gap-1 text-2xl">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => rate(g.id, n)}>
                      {n <= myStars ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

function Stage7Simulation({ workshopId, myGroup, allGroups, onAdvance }: Props) {
  const media = useMedia(workshopId, 7);
  const [myClipReady, setMyClipReady] = useState(false);
  const allReady = allGroups.every((g) => media.some((m) => m.group_id === g.id));

  const myClipExists = media.some((m) => m.group_id === myGroup.id);

  if (!myClipExists && !myClipReady) {
    return (
      <SolutionAndRecord
        workshopId={workshopId}
        myGroup={myGroup}
        onDone={() => setMyClipReady(true)}
      />
    );
  }

  if (!allReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">ממתינים שכל הקבוצות יסיימו להקליט...</h1>
        <div className="flex flex-col gap-2">
          {allGroups
            .slice()
            .sort((a, b) => a.screen_number - b.screen_number)
            .map((g) => (
              <div key={g.id}>
                {media.some((m) => m.group_id === g.id) ? "✅" : "⏳"} {g.name ?? `מסך ${g.screen_number}`}
              </div>
            ))}
        </div>
      </main>
    );
  }

  return (
    <SharedViewing
      workshopId={workshopId}
      myGroup={myGroup}
      allGroups={allGroups}
      onAdvance={onAdvance}
    />
  );
}

export default Stage7Simulation;
