@echo off
title Way Servidores - Painel
cd /d "%~dp0"

echo ==========================================
echo  Way Servidores - iniciando painel...
echo ==========================================

rem Garante o build do backend na primeira vez
if not exist "backend\dist\backend\src\index.js" (
  echo Primeira vez: compilando backend...
  call npm run build -w backend
)

rem API na porta 4000
start "Way API" /min cmd /c "cd /d ""%~dp0"" && node backend/dist/backend/src/index.js"
timeout /t 2 /nobreak >nul

rem Frontend (Vite) na porta 5173
start "Way Front" /min cmd /c "cd /d ""%~dp0frontend"" && ..\node_modules\.bin\vite.cmd --port 5173 --strictPort"
timeout /t 6 /nobreak >nul

rem Abre o navegador
start http://localhost:5173

echo.
echo Painel em http://localhost:5173  (API em http://localhost:4000/api)
echo Feche estas 2 janelas minimizadas para parar tudo.
timeout /t 5 /nobreak >nul
exit
