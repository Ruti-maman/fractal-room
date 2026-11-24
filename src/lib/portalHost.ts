import { createContext, useContext } from "react";

/**
 * לאן "חלונות צפים" (createPortal) נשלחים. ברירת מחדל: document.body.
 * בגלריית הלופים של המסך הגדול (LoopGallery) החלון הקטן מספק כאן את עצמו -
 * כך שחלון הטיפים וכלל הפרקטל נפתחים בתוכו ולא על כל המסך.
 */
export const PortalHostContext = createContext<HTMLElement | null>(null);

export function usePortalHost(): HTMLElement {
  return useContext(PortalHostContext) ?? document.body;
}
