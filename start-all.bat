@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===========================================
echo   期末速通 - 一键启动（前端 + AI 后端）
echo ===========================================
echo.

REM 杀掉旧进程（如有残留）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8766" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul

REM 检查 .env
if not exist ".env" (
  echo [错误] 找不到 .env 文件！请先创建并填入 MIMO_API_KEY
  pause
  exit /b 1
)

echo [1/3] 启动 AI 后端（端口 8766）...
start "AI Backend" /min cmd /c "node ai_server.js"
timeout /t 2 /nobreak >nul

echo [2/3] 启动前端静态服务（端口 8765）...
start "Frontend" /min cmd /c "node serve.js"
timeout /t 1 /nobreak >nul

echo [3/3] 检查两个服务是否就绪...
powershell -NoProfile -Command "$ok=$true; try { (Invoke-WebRequest http://127.0.0.1:8766/health -UseBasicParsing -TimeoutSec 3).StatusCode } catch { Write-Host '  AI 后端未就绪'; $ok=$false }; try { (Invoke-WebRequest http://127.0.0.1:8765/ -UseBasicParsing -TimeoutSec 3).StatusCode } catch { Write-Host '  前端未就绪'; $ok=$false }"

echo.
echo ===========================================
echo   浏览器打开 http://127.0.0.1:8765
echo ===========================================
echo.
echo 提示：
echo   - 看到两个黑色窗口分别跑 ai_server.js 和 serve.js，关掉它们就停止服务
echo   - 下次再启动直接双击本文件即可，env 不会再丢
echo.
pause
