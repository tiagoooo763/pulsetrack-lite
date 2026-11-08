@echo off
setlocal
echo ========================================================
echo   PulseTrack Lite - Deploy na Vercel
echo ========================================================
echo.

set PATH=%PATH%;C:\Users\mendo\AppData\Local\Programs\MinGit\cmd;C:\Users\mendo\AppData\Local\Programs\gh\gh_2.62.0_windows_amd64\bin

echo [1/2] Verificando login na Vercel CLI...
call npx vercel whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo Faca login na sua conta Vercel no navegador que sera aberto...
    call npx vercel login
)

echo.
echo [2/2] Realizando deploy em producao (--prod)...
call npx vercel --prod --yes

echo.
echo ========================================================
echo   Deploy finalizado com sucesso!
echo ========================================================
pause
