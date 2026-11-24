export type Stage1Screen =
  | { type: "logo"; image_url: string }
  | { type: "video"; video_url: string }
  | { type: "text"; title: string; body: string };

export interface Stage1Content {
  screens: Record<string, Stage1Screen>;
  transition_text: string;
  /**
   * מסך ההסבר אחרי "ברוכות הבאות" (2026-11-25, דרישת הלקוחה). אופציונלי -
   * בלי ערך במסד מוצגים הטקסטים של RESOURCES_DEFAULTS ב-Stage1OpeningEditorial.
   */
  resources?: {
    title?: string;
    text?: string;
    room_line?: string;
    button?: string;
  };
}
