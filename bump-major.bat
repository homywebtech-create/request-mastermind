@echo off
REM سكريبت سهل لتحديث الإصدار (major) - Windows
REM استخدام: bump-major.bat

echo ================================================
echo تحديث الإصدار (Major - إصدار جديد)
echo ================================================
echo.

node scripts/bump-version.js major

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
