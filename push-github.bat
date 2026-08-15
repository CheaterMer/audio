@echo off
title AudioVault GitHub Push
cd /d "%~dp0"

echo [AudioVault] Pushing to CheaterMer/my-audio-web...
git add -A
git commit -m "AudioVault GitHub Pages release"
git push -u origin main --force

echo.
pause
