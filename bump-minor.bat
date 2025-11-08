@echo off
REM سكريبت سهل لتحديث الإصدار (minor) - Windows
REM استخدام: bump-minor.bat

echo ================================================
echo تحديث الإصدار (Minor - ميزة جديدة)
echo ================================================
echo.

node scripts/bump-version.js minor

if %ERRORLEVEL% EQU 0 (
    echo.
    echo تم التحديث بنجاح!
    echo.
    echo الخطوات التالية:
    echo    npx cap sync android
    echo.
) else (
    echo.
    echo حدث خطأ في التحديث
    exit /b 1
)
