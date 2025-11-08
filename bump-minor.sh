#!/bin/bash

# سكريبت سهل لتحديث الإصدار (minor)
# استخدام: ./bump-minor.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎁 تحديث الإصدار (Minor - ميزة جديدة)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/bump-version.js minor

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
