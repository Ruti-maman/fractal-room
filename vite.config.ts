import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import localClips from './vite-plugin-local-clips.js'

// https://vite.dev/config/
export default defineConfig({
  // localClips שומר את הקלטות שלב 7 כקבצים בתוך public/recordings, כדי שיהיה
  // אפשר לצפות בהן מקומית בלי אינטרנט (ראו ההסבר בקובץ התוסף עצמו).
  plugins: [react(), tailwindcss(), localClips()],
})
