import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installAudioUnlock } from './lib/audioUnlock'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// רשת ביטחון לקול: אם מסך נפתח בלי לעבור דרך "התחילו" (רענון באמצע סדנה),
// הנגיעה הבאה על המסך תפתח את הרשאת הקול לשאר הסדנה.
installAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
