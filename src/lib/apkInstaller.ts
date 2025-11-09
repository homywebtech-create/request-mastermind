import { registerPlugin } from '@capacitor/core';

export interface ApkInstallerPlugin {
  installApk(options: { filePath: string }): Promise<{ success: boolean }>;
  uninstallApp(): Promise<{ success: boolean }>;
  uninstallThenOpen(options: { url: string }): Promise<{ success: boolean }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

export default ApkInstaller;
