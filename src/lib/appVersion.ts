// App version information
export const APP_VERSION = {
  version: '1.2.7',
  code: 22, // Android versionCode - increment for each release
  buildDate: '2025-11-04',
  buildTime: '22:30:00',
};

export function getAppVersion() {
  return APP_VERSION.version;
}

export function getBuildDate() {
  return APP_VERSION.buildDate;
}

export function getBuildTime() {
  return APP_VERSION.buildTime;
}

export function getFullVersionInfo() {
  return `${APP_VERSION.version} (${APP_VERSION.buildDate} ${APP_VERSION.buildTime})`;
}
