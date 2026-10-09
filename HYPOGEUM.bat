@echo off
rem HYPOGEUM // KKR-40 をローカルで起動する（ダブルクリック）
rem Node.js が必要です： https://nodejs.org/
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ からインストールしてください。
  pause
  exit /b 1
)
set PORT=8080
start "" "http://localhost:%PORT%/"
node scripts\serve.mjs %PORT%
pause
