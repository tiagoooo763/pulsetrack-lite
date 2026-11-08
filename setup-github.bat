@echo off
setlocal
echo ========================================================
echo   PulseTrack Lite - Publicar no GitHub
echo ========================================================
echo.

set PATH=%PATH%;C:\Users\mendo\AppData\Local\Programs\MinGit\cmd;C:\Users\mendo\AppData\Local\Programs\gh\gh_2.62.0_windows_amd64\bin

echo [1/3] Verificando login no GitHub...
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo Voce ainda nao esta logado no GitHub CLI.
    echo Iniciando autenticacao no navegador...
    gh auth login --web --git-protocol https
)

echo.
echo [2/3] Criando repositorio no GitHub (se ainda nao existir)...
gh repo create tiagoooo763/pulsetrack-lite --public --source=. --remote=origin --description="PulseTrack Lite - Dashboard financeiro com integracao oficial OmegaPay v1" 2>nul
if %errorlevel% neq 0 (
    echo Repositorio ja existe ou vinculando remote origin existente...
    git remote remove origin 2>nul
    git remote add origin https://github.com/tiagoooo763/pulsetrack-lite.git
)

echo.
echo [3/3] Enviando codigo para a branch main...
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo   Sucesso! Repositorio atualizado no GitHub:
echo   https://github.com/tiagoooo763/pulsetrack-lite
echo ========================================================
pause
