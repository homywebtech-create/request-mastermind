@echo off
REM سكريبت سهل لتحديث الإصدار (patch) - Windows
REM استخدام: bump-patch.bat

echo ================================================
echo تحديث الإصدار (Patch)
echo ================================================
echo.

node scripts/bump-version.js patch

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
