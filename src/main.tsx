import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installAudioUnlock } from './lib/audioUnlock'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast'

// רשת ביטחון לקול: אם מסך נפתח בלי לעבור דרך "התחילו" (רענון באמצע סדנה),
// הנגיעה הבאה על המסך תפתח את הרשאת הקול לשאר הסדנה.
installAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* ספק ההודעות עוטף את כל האפליקציה כדי שכל מסך יוכל לאשר פעולה
          (שמירה, שגיאה) בלי להחזיק מנגנון הודעות משלו. */}
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
