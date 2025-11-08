@echo off
REM سكريبت للتحقق من الإصدار الحالي - Windows
REM استخدام: check-version.bat

echo ================================================
echo الإصدار الحالي
echo ================================================
echo.

if exist "version.json" (
    type version.json
    echo.
    echo.
    echo ================================================
) else (
    echo ملف version.json غير موجود
    echo قم بتشغيل أحد سكريبتات التحديث أولاً
    echo.
)
