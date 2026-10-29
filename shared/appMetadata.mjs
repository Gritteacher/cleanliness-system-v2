import packageInfo from '../package.json' with { type: 'json' };

// Shared by the website and every export. Update package.json for a new release.
export const APP_VERSION = packageInfo.version;
export const APP_NAME_TH = 'ระบบบริหารจัดการกิจกรรมคณะสี';
export const APP_SHORT_NAME_TH = 'กิจกรรมคณะสี';
export const APP_NAME_EN = 'Color Team Activity Management';
export const APP_SHORT_NAME_EN = 'Color Team Activities';
export const DEVELOPER_NAME = 'นายกฤษณพล ทองอุ่น';
export const DEVELOPER_CREDIT = `${DEVELOPER_NAME} ผู้พัฒนา`;
export const APP_ATTRIBUTION = `เวอร์ชัน ${APP_VERSION} · ${DEVELOPER_CREDIT}`;
