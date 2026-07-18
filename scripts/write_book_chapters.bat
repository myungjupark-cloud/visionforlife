@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%~1"=="" (
  echo 사용법: write_book_chapters.bat toc.txt
  echo 예:     write_book_chapters.bat toc.example.txt
  echo.
  echo 먼저 진리서재 서버를 켜 두세요: ..\serve.bat
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0write_book_chapters.ps1" -TocPath "%~1" %2 %3 %4 %5
pause
