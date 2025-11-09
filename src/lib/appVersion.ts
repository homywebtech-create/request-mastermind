// App version information
export const APP_VERSION = {
  version: '1.3.10',
  code: 35, // Android versionCode - increment for each release
  buildDate: '2025-01-09',
  buildTime: '12:00:00',
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
