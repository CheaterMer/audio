# AudioVault GitHub Push Script for PowerShell
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "[AudioVault] CheaterMer/my-audio-web GitHub 푸시 시작" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$destDir = $PSScriptRoot
Set-Location $destDir

# Initialize git if not already
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    git remote add origin https://github.com/CheaterMer/my-audio-web.git
}

git add -A
git commit -m "AudioVault GitHub Pages release"

Write-Host ""
Write-Host "GitHub로 업로드(Push)를 시도합니다..." -ForegroundColor Yellow
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "🎉 GitHub Pages 저장소에 성공적으로 푸시되었습니다!" -ForegroundColor Green
    Write-Host "👉 https://cheatermer.github.io/my-audio-web/" -ForegroundColor Cyan
    Write-Host "===================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host "⚠️ GitHub 인증 실패 또는 권한 오류가 발생했습니다." -ForegroundColor Yellow
    Write-Host "CheaterMer 계정으로 GitHub 로그인이 필요합니다." -ForegroundColor White
    Write-Host ""
    Write-Host "아래 대안 중 하나를 진행해 주세요:" -ForegroundColor Cyan
    Write-Host "1. 웹 브라우저에서 업로드: https://github.com/CheaterMer/my-audio-web/upload/main" -ForegroundColor White
    Write-Host "2. GitHub CLI 로그인: gh auth login" -ForegroundColor White
    Write-Host "===================================================" -ForegroundColor Red
}
