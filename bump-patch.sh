#!/bin/bash

# سكريبت سهل لتحديث الإصدار (patch)
# استخدام: ./bump-patch.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 تحديث الإصدار (Patch)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/bump-version.js patch

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
