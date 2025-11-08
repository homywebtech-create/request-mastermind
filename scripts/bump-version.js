#!/usr/bin/env node

/**
 * نظام تلقائي لإدارة إصدارات التطبيق
 * يقوم بزيادة versionCode و versionName تلقائياً
 */

const fs = require('fs');
const path = require('path');

// المسارات
const VERSION_FILE = path.join(__dirname, '..', 'version.json');
const BUILD_GRADLE_FILE = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

// قراءة نوع الزيادة من الأرجومنت (patch, minor, major)
const bumpType = process.argv[2] || 'patch';

// قراءة ملف الإصدار الحالي
function readVersionFile() {
  try {
    const data = fs.readFileSync(VERSION_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // إذا لم يوجد الملف، ننشئ إصدار افتراضي
    console.log('⚠️  ملف version.json غير موجود، سيتم إنشاؤه...');
    return {
      versionCode: 28,
      versionName: '1.3.3'
    };
  }
}

// زيادة رقم الإصدار
function bumpVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      // 1.3.3 -> 2.0.0
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      // 1.3.3 -> 1.4.0
      parts[1] += 1;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      // 1.3.3 -> 1.3.4
      parts[2] += 1;
      break;
  }
  
  return parts.join('.');
}

// تحديث ملف build.gradle
function updateBuildGradle(versionCode, versionName) {
  try {
    let content = fs.readFileSync(BUILD_GRADLE_FILE, 'utf8');
    
    // تحديث versionCode
    content = content.replace(
      /versionCode\s+\d+/,
      `versionCode ${versionCode}`
    );
    
    // تحديث versionName
    content = content.replace(
      /versionName\s+"[^"]+"/,
      `versionName "${versionName}"`
    );
    
    fs.writeFileSync(BUILD_GRADLE_FILE, content, 'utf8');
    return true;
  } catch (error) {
    console.error('❌ خطأ في تحديث build.gradle:', error.message);
    return false;
  }
}

// حفظ الإصدار الجديد
function saveVersionFile(versionData) {
  const content = JSON.stringify(versionData, null, 2);
  fs.writeFileSync(VERSION_FILE, content, 'utf8');
}

// البرنامج الرئيسي
function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 نظام تحديث الإصدارات التلقائي');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. قراءة الإصدار الحالي
  const currentVersion = readVersionFile();
  console.log(`📋 الإصدار الحالي:`);
  console.log(`   versionCode: ${currentVersion.versionCode}`);
  console.log(`   versionName: ${currentVersion.versionName}\n`);
  
  // 2. حساب الإصدار الجديد
  const newVersionCode = currentVersion.versionCode + 1;
  const newVersionName = bumpVersion(currentVersion.versionName, bumpType);
  
  console.log(`✨ الإصدار الجديد (${bumpType}):`);
  console.log(`   versionCode: ${newVersionCode} (+1)`);
  console.log(`   versionName: ${newVersionName}\n`);
  
  // 3. تحديث build.gradle
  console.log('📝 تحديث android/app/build.gradle...');
  if (!updateBuildGradle(newVersionCode, newVersionName)) {
    console.error('❌ فشل تحديث build.gradle');
    process.exit(1);
  }
  console.log('✅ تم تحديث build.gradle بنجاح\n');
  
  // 4. حفظ الإصدار الجديد
  console.log('💾 حفظ الإصدار الجديد...');
  saveVersionFile({
    versionCode: newVersionCode,
    versionName: newVersionName,
    updatedAt: new Date().toISOString(),
    bumpType: bumpType
  });
  console.log('✅ تم حفظ version.json بنجاح\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 تم تحديث الإصدار بنجاح!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📌 الخطوات التالية:');
  console.log('   1. npx cap sync android');
  console.log('   2. ابنِ التطبيق من Android Studio');
  console.log('   3. ارفع الإصدار الجديد\n');
}

// تشغيل البرنامج
try {
  main();
} catch (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
}
