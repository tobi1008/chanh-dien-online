@echo off
rem Double-click to start the Chanh Dien live server, then the control panel opens in the default browser.
rem Keep this window open while streaming: closing it stops the server.
chcp 65001 >nul
title Chanh Dien Live - KHONG DONG CUA SO NAY KHI DANG LIVE
cd /d "%~dp0"

echo.
echo   ==========================================================
echo     CHANH DIEN TINH TAM - LIVE
echo   ----------------------------------------------------------
echo     Bang dieu khien: http://localhost:3000/live/control.html
echo     Overlay 9:16   : http://localhost:3000/live/overlay.html
echo.
echo     KHONG dong cua so nay trong luc live.
echo     Dong cua so nay = tat Chanh Dien.
echo   ==========================================================
echo.

rem OPEN_UI=1: once running, the server opens the control panel and the overlay window (Edge app, sound on by itself)
set OPEN_UI=1
set CD_RESTARTED=
:run
"%~dp0node\node.exe" "%~dp0live\server.mjs"
rem exit code 42 = the control panel just installed an update: start the new server (windows already open stay open)
if %ERRORLEVEL%==42 (
  set CD_RESTARTED=1
  echo.
  echo   Da cap nhat xong, dang khoi dong lai...
  echo.
  goto run
)

echo.
echo   Chanh Dien da dung. Nhan phim bat ky de dong cua so.
pause >nul
