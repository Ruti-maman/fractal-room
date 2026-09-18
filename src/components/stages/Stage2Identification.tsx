import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParticipants } from "../../hooks/useParticipants";
import type { Group } from "../../types/group";

const MAX_PARTICIPANTS = 15;

interface Props {
  screenNumber: number;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

function IdentificationForm({ myGroup }: { myGroup: Group }) {
  const [name, setName] = useState("");
  const [participantNames, setParticipantNames] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  function updateParticipant(index: number, value: string) {
    setParticipantNames((current) =>
      current.map((p, i) => (i === index ? value : p)),
    );
  }

  function addParticipant() {
    if (participantNames.length >= MAX_PARTICIPANTS) return;
    setParticipantNames((current) => [...current, ""]);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    await supabase.from("groups").update({ name: name.trim() }).eq("id", myGroup.id).then();

    const rows = participantNames
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => ({ group_id: myGroup.id, name: p }));
    if (rows.length > 0) {
      await supabase.from("participants").insert(rows).then();
    }
    setSaving(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">הזדהות</h1>

      <input
        className="w-80 rounded-xl bg-white/10 px-4 py-3 text-center text-xl outline-none"
        placeholder="שם הקבוצה"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-3">
        {participantNames.map((p, i) => (
          <input
            key={i}
            className="w-80 rounded-xl bg-white/10 px-4 py-3 text-center text-lg outline-none"
            placeholder={`שם משתתפת ${i + 1}`}
            value={p}
            onChange={(e) => updateParticipant(i, e.target.value)}
          />
        ))}
      </div>

      {participantNames.length < MAX_PARTICIPANTS && (
        <button
          className="rounded-xl bg-white/10 px-6 py-3 text-lg active:scale-90"
          onClick={addParticipant}
        >
          + הוסיפי משתתפת
        </button>
      )}

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-2xl font-bold transition-transform duration-100 active:scale-90 disabled:opacity-50"
        onClick={handleSave}
        disabled={!name.trim() || saving}
      >
        {saving ? "שומרת..." : "שמרי"}
      </button>
    </main>
  );
}

function RoomStatusNames({
  allGroups,
  onNext,
}: {
  allGroups: Group[];
  onNext: () => void;
}) {
  const groupIds = allGroups.map((g) => g.id);
  const participants = useParticipants(groupIds);
  const allIdentified = allGroups.every((g) => g.name);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">מצב החדר</h1>

      <div className="flex gap-6">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g) => (
            <div key={g.id} className="rounded-xl bg-white/10 px-6 py-4 text-center">
              <div className="mb-2 text-xl font-bold">{g.name ?? "טרם הזדהו"}</div>
              <div className="flex flex-col gap-1 text-sm text-white/70">
                {participants
                  .filter((p) => p.group_id === g.id)
                  .map((p) => (
                    <span key={p.id}>{p.name}</span>
                  ))}
              </div>
            </div>
          ))}
      </div>

      {allIdentified ? (
        <button
          className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-2xl font-bold transition-transform duration-100 active:scale-90"
          onClick={onNext}
        >
          הבא
        </button>
      ) : (
        <p className="text-white/70">ממתינים שכל הקבוצות יזדהו...</p>
      )}
    </main>
  );
}

function DilemmaVideo({ onAdvance }: { onAdvance: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-3xl font-bold">הדילמה הפדגוגית</h1>
      <p className="max-w-lg text-lg text-white/80">
        הצגת הדילמה המרכזית שאיתה נתמודד לאורך הסדנה.
      </p>

      <div className="flex h-64 w-96 items-center justify-center rounded-xl bg-white/10 text-white/50">
        כאן יופיע סרטון הדילמה
      </div>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-2xl font-bold transition-transform duration-100 active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
    </main>
  );
}

function RoomStatus({
  allGroups,
  onAdvance,
}: {
  allGroups: Group[];
  onAdvance: () => void;
}) {
  const [showingVideo, setShowingVideo] = useState(false);

  if (showingVideo) {
    return <DilemmaVideo onAdvance={onAdvance} />;
  }
  return <RoomStatusNames allGroups={allGroups} onNext={() => setShowingVideo(true)} />;
}

function Stage2Identification({ myGroup, allGroups, onAdvance }: Props) {
  if (!myGroup.name) {
    return <IdentificationForm myGroup={myGroup} />;
  }
  return <RoomStatus allGroups={allGroups} onAdvance={onAdvance} />;
}

export default Stage2Identification;
