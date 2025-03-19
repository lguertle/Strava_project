# PowerShell script to check which files will be ignored by Git before pushing to GitHub

Write-Host "=== Files that will be IGNORED by Git ===" -ForegroundColor Yellow
git status --ignored | Select-String -Pattern "Untracked files:|Ignored files:"

Write-Host "`n=== Files that will be INCLUDED in the next commit ===" -ForegroundColor Green
git status --short

Write-Host "`nVerify that all test files and utilities are properly excluded."
Write-Host "If everything looks correct, you can proceed with your commit and push:" -ForegroundColor Cyan
Write-Host "git add ." -ForegroundColor Cyan
Write-Host "git commit -m 'Your commit message'" -ForegroundColor Cyan  
Write-Host "git push" -ForegroundColor Cyan 