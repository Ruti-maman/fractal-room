/**
 * תצוגה מקדימה של שעון החול (רק בפיתוח): /preview/hourglass?s=55
 * s = כמה שניות "כבר עברו" מתחילת הדיון - כדי לראות היפוך בלי לחכות דקה.
 */
import { useMemo } from "react";
import Hourglass from "../components/Hourglass";

function HourglassPreview() {
  const startedAt = useMemo(() => {
    const s = Number(new URLSearchParams(window.location.search).get("s") ?? "0");
    return new Date(Date.now() - s * 1000).toISOString();
  }, []);
  return (
    <main className="flex h-dvh items-center justify-center bg-[#f4f6fb]">
      <Hourglass startedAt={startedAt} durationMinutes={10} label="זמן לעריכת הדיון" />
    </main>
  );
}

export default HourglassPreview;
