export type Stage1Screen =
  | { type: "logo"; image_url: string }
  | { type: "video"; video_url: string }
  | { type: "text"; title: string; body: string };

export interface Stage1Content {
  screens: Record<string, Stage1Screen>;
  transition_text: string;
}
