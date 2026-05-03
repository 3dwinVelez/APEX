@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "VENV_PYTHON=%ROOT_DIR%.venv\Scripts\python.exe"

echo ==========================================
echo Iniciando APEX ERP
echo Backend: %BACKEND_DIR%
echo Frontend: %FRONTEND_DIR%
echo ==========================================

if exist "%VENV_PYTHON%" (
    set "PYTHON_CMD=%VENV_PYTHON%"
) else (
    set "PYTHON_CMD=python"
)

start "APEX Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && %PYTHON_CMD% main_api.py"
start "APEX Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm start"

echo.
echo Se abrieron las ventanas de backend y frontend.
echo Si alguna se cierra, revisa el mensaje de error en esa ventana.
echo.
pause
