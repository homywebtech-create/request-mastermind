import { registerPlugin } from '@capacitor/core';

export interface ApkInstallerPlugin {
  installApk(options: { filePath: string }): Promise<{ success: boolean }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

export default ApkInstaller;
