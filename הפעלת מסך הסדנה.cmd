@echo off
chcp 65001 >nul
rem ============================================================
rem  פתיחת מסך הסדנה עם הרשאת קול אוטומטי.
rem
rem  Chrome חוסם ניגון עם קול עד שנוגעים במסך. הדגל
rem  --autoplay-policy=no-user-gesture-required מבטל את החסימה,
rem  וזו הדרך היחידה לקבל קול אוטומטי בלי נגיעה.
rem
rem  שימוש: להריץ את הקובץ עם מספר המסך, למשל:  הפעלת מסך הסדנה.cmd 2
rem  בלי מספר - נפתח מסך 1.
rem ============================================================

set SCREEN=%1
if "%SCREEN%"=="" set SCREEN=1

set URL=http://localhost:5173/screen/%SCREEN%

set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not exist %CHROME% (
  echo לא נמצא Chrome במחשב. אפשר לפתוח ידנית עם הדגל:
  echo   chrome.exe --autoplay-policy=no-user-gesture-required %URL%
  pause
  exit /b 1
)

start "" %CHROME% --autoplay-policy=no-user-gesture-required --autoplay-policy-allow-user-gestures=false --start-fullscreen --user-data-dir="%TEMP%\fractal-room-kiosk-%SCREEN%" %URL%
