import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ isIgnoring: boolean }>;
  requestBatteryOptimizationExemption(): Promise<void>;
  isXiaomiDevice(): Promise<{ isXiaomi: boolean }>;
  openAutostartSettings(): Promise<void>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

/**
 * Check if the app is exempted from battery optimizations
 */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') {
    return true;
  }

  try {
    const result = await BatteryOptimization.isIgnoringBatteryOptimizations();
    console.log('🔋 Battery optimization status:', result.isIgnoring ? 'EXEMPTED' : 'RESTRICTED');
    return result.isIgnoring;
  } catch (error) {
    console.error('❌ Error checking battery optimization:', error);
    return false;
  }
}

/**
 * Request battery optimization exemption
 * Critical for receiving FCM notifications when app is killed, especially on Xiaomi/Redmi devices
 */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    console.log('⚠️ Battery optimization only needed on Android');
    return;
  }

  try {
    console.log('🔋 Requesting battery optimization exemption...');
    await BatteryOptimization.requestBatteryOptimizationExemption();
    console.log('✅ Battery optimization exemption requested');
  } catch (error) {
    console.error('❌ Error requesting battery optimization exemption:', error);
  }
}

/**
 * Check if device is Xiaomi/Redmi
 */
export async function isXiaomiDevice(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') {
    return false;
  }

  try {
    const result = await BatteryOptimization.isXiaomiDevice();
    console.log('📱 Device check:', result.isXiaomi ? 'Xiaomi/Redmi' : 'Other');
    return result.isXiaomi;
  } catch (error) {
    console.error('❌ Error checking device type:', error);
    return false;
  }
}

/**
 * Open autostart settings (Xiaomi specific)
 * Critical for MIUI/HyperOS to allow the app to receive notifications when killed
 */
export async function openAutostartSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    console.log('⚠️ Autostart settings only available on Android');
    return;
  }

  try {
    console.log('🚀 Opening autostart settings...');
    await BatteryOptimization.openAutostartSettings();
    console.log('✅ Autostart settings opened');
  } catch (error) {
    console.error('❌ Error opening autostart settings:', error);
  }
}
