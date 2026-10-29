import packageInfo from '../package.json' with { type: 'json' };

// Shared by the website and every export. Update package.json for a new release.
export const APP_VERSION = packageInfo.version;
export const DEVELOPER_NAME = 'นายกฤษณพล ทองอุ่น';
export const DEVELOPER_CREDIT = `${DEVELOPER_NAME} ผู้พัฒนา`;
export const APP_ATTRIBUTION = `เวอร์ชัน ${APP_VERSION} · ${DEVELOPER_CREDIT}`;
