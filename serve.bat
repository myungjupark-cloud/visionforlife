@echo off
cd /d "%~dp0"
echo 진리서재 local server
echo   PC: http://localhost:8780/
echo   faith-mindmap uses port 8770 (separate project)
echo.
python api.py
