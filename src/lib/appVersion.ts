// App version information
export const APP_VERSION = {
  version: '1.0.1',
  code: 1, // Android versionCode - increment for each release
  buildDate: '2025-01-31',
  buildTime: '14:30:00',
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
