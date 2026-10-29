import { APP_VERSION, APP_ATTRIBUTION, DEVELOPER_NAME, DEVELOPER_CREDIT } from '../../shared/appMetadata.mjs';

export function applyWorkbookAttribution(workbook) {
  workbook.creator = DEVELOPER_NAME;
  workbook.lastModifiedBy = DEVELOPER_NAME;
  workbook.description = APP_ATTRIBUTION;
  for (const sheet of workbook.worksheets) {
    // Keep the table, filter and frozen rows unchanged. Credit is outside the data.
    const rowNumber = sheet.rowCount + 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, Math.max(1, sheet.columnCount));
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = APP_ATTRIBUTION;
    cell.font = { name: 'Sarabun', size: 10, color: { argb: 'FF68736C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(rowNumber).height = 30;
    sheet.headerFooter = { ...sheet.headerFooter, differentFirst: false, differentOddEven: false,
      oddFooter: `&Lเวอร์ชัน ${APP_VERSION}&C${DEVELOPER_CREDIT}&R&P / &N` };
  }
}
