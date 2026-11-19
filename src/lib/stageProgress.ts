/*
 * התקדמות בתוך השלב הנוכחי (0..1), לפס ההתקדמות של כל הסדנה
 * (ProjectProgressBar). שלב שיש בו צעדים פנימיים - כמו ההזדהות בשלב 2 -
 * מדווח כאן כמה מהם עבר, והפס מתקדם גם בתוך השלב ולא רק בין שלבים.
 * שלב שלא מדווח - נחשב 0 עד שעוברים לשלב הבא.
 */
import { useSyncExternalStore } from "react";

let sub = 0;
const listeners = new Set<() => void>();

export function setStageSubProgress(value: number) {
  const v = Math.max(0, Math.min(1, value));
  if (v === sub) return;
  sub = v;
  listeners.forEach((fn) => fn());
}

export function useStageSubProgress() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => sub,
  );
}
