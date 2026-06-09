@echo off
chcp 65001 > nul
setlocal

rem ============= 配置区 =============
rem 米 mimo Token Plan（key 以 tp- 开头）专属 base URL
set MIMO_API_KEY=tp-cbqb9vwgi0oj9i8t4y7z3l99508vxwj2jirhm961iftvd4bc
set MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
set MIMO_MODEL=mimo-v2.5-pro
rem ===================================

if "%MIMO_API_KEY%"=="" goto :nokey
if "%MIMO_API_KEY%"=="sk-你的米mimo-key-在这里填" goto :placeholder

echo.
echo ====================================================
echo   期末速通 AI 后端启动中...
echo   model = %MIMO_MODEL%
echo   base  = %MIMO_BASE_URL%
echo   port  = 8766
echo ====================================================
echo.

node "%~dp0ai_server.js"

goto :eof

:placeholder
echo.
echo  [错误] 请先打开本文件，把 MIMO_API_KEY 的占位值改成你真实的 key
echo.
pause
exit /b 1

:nokey
echo.
echo  [错误] MIMO_API_KEY 未设置
echo.
pause
exit /b 1
