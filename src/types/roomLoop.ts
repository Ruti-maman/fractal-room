/** לופ שהלקוחה הוסיפה ב-/admin (טבלת room_loops, supabase/add_room_loops.sql). */
export type RoomLoopKind = "manual" | "video";
export type RoomLoopColor = "orange" | "blue" | "white";

export interface RoomLoopRow {
  id: string;
  title: string;
  kind: RoomLoopKind;
  color: RoomLoopColor;
  /** לופ ידני - שקף לכל פריט */
  slides: { text: string }[];
  /** לופ סרטון */
  video_url: string | null;
  sort_order: number;
}

export const ROOM_LOOP_COLORS: { value: RoomLoopColor; label: string }[] = [
  { value: "orange", label: "כתום" },
  { value: "blue", label: "כחול" },
  { value: "white", label: "לבן" },
];
