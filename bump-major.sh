#!/bin/bash

# سكريبت سهل لتحديث الإصدار (major)
# استخدام: ./bump-major.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 تحديث الإصدار (Major - إصدار جديد)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/bump-version.js major

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ تم التحديث بنجاح!"
    echo ""
    echo "📌 الخطوات التالية:"
    echo "   npx cap sync android"
    echo ""
else
    echo ""
    echo "❌ حدث خطأ في التحديث"
    exit 1
fi
