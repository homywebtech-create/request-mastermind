#!/bin/bash

# سكريبت للتحقق من الإصدار الحالي
# استخدام: ./check-version.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 الإصدار الحالي"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "version.json" ]; then
    cat version.json
    echo ""
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "⚠️  ملف version.json غير موجود"
    echo "   قم بتشغيل أحد سكريبتات التحديث أولاً"
    echo ""
fi
