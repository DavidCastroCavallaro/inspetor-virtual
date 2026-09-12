@echo off
title Inspetor Virtual - inicializador
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao encontrado. Instale em https://nodejs.org (versao LTS) e rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist "%~dp0backend\node_modules" (
  echo Primeira vez neste computador - instalando dependencias do backend (uma vez so, precisa de internet)...
  pushd "%~dp0backend"
  call npm install
  popd
)

if not exist "%~dp0frontend\node_modules" (
  echo Primeira vez neste computador - instalando dependencias do frontend (uma vez so, precisa de internet)...
  pushd "%~dp0frontend"
  call npm install
  popd
)

if not exist "%~dp0backend\.env" (
  echo Criando backend\.env a partir do exemplo (sem chave = modo MOCK)...
  copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
)

echo Iniciando a API (porta 8787)...
start "Inspetor Virtual - API 8787" /D "%~dp0backend" cmd /k "npm run dev"

echo Iniciando o site / PWA (porta 3000)...
start "Inspetor Virtual - PWA 3000" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Duas janelas foram abertas. Aguarde ~10 segundos e acesse:
echo    https://localhost:3000
echo.
echo Para desligar o app: feche as duas janelas.
timeout /t 10 >nul
start "" "https://localhost:3000"
