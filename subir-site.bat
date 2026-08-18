@echo off
title Way Servidores - Site Online
cd /d "%~dp0"
echo ============================================================
echo  WAY SERVIDORES - colocando o site no ar (PC = servidor)
echo ============================================================
echo.

echo [1/3] Iniciando a API (backend)...
start "way-api" /min cmd /c "node backend\dist\backend\src\index.js"

echo [2/3] Iniciando o painel (frontend)...
start "way-vite" /min cmd /c "cd frontend && node ..\node_modules\vite\bin\vite.js --port 5173 --strictPort"

echo Aguardando o painel subir...
timeout /t 10 /nobreak > nul

echo [3/4] Abrindo o tunel do PlayIt (servidor Minecraft)...
start "way-playit" /min "%LOCALAPPDATA%\Programs\playit\playit.exe" --no-open-web

echo [4/4] Abrindo o tunel gratuito do Cloudflare (painel)...
echo.
echo A URL do seu site aparece na caixa "Your quick Tunnel has been created!"
echo Copie e compartilhe. MANTENHA ESTA JANELA ABERTA (fechar derruba o site).
echo ============================================================
"%LOCALAPPDATA%\Programs\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173 --no-autoupdate
pause