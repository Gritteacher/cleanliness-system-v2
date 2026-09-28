const COLORS = {
  green900: '183D2A',
  green700: '356B4C',
  green100: 'DCECE1',
  yellow100: 'F9EDBE',
  yellow50: 'FFF9E8',
  ink: '1F2A22',
  muted: '68736C',
  line: 'DDE3DC',
  white: 'FFFFFF'
};

const thinBorder = {
  top: { style: 'thin', color: { argb: COLORS.line } },
  left: { style: 'thin', color: { argb: COLORS.line } },
  bottom: { style: 'thin', color: { argb: COLORS.line } },
  right: { style: 'thin', color: { argb: COLORS.line } }
};

function excelDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function scoreAverage(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value != null).map(Number);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sortAndRank(rows, key, tieBreakers = []) {
  const metrics = [key, ...tieBreakers];
  const sorted = [...rows].sort((a, b) => {
    if (a[key] == null && b[key] == null) return a.team.sort_order - b.team.sort_order;
    if (a[key] == null) return 1;
    if (b[key] == null) return -1;
    for (const metric of metrics) {
      const difference = Number(b[metric] || 0) - Number(a[metric] || 0);
      if (difference) return difference;
    }
    return a.team.sort_order - b.team.sort_order;
  });
  return new Map(sorted.map((row, index) => [row.team.id, row[key] == null ? null : index + 1]));
}

function normalizeData(teams, scores) {
  const latestByTeamDate = new Map();
  scores.forEach((score) => latestByTeamDate.set(`${score.team_id}:${score.score_date}`, score));
  const dailyRows = [...latestByTeamDate.values()].sort((a, b) => {
    const dateDifference = a.score_date.localeCompare(b.score_date);
    if (dateDifference) return dateDifference;
    const teamA = teams.find((team) => team.id === a.team_id);
    const teamB = teams.find((team) => team.id === b.team_id);
    return (teamA?.sort_order || 0) - (teamB?.sort_order || 0);
  });
  const summaryRows = teams.map((team) => {
    const teamScores = dailyRows.filter((score) => score.team_id === team.id);
    const cleanliness = scoreAverage(teamScores, 'cleanliness_score');
    const management = scoreAverage(teamScores, 'attendance_score');
    return {
      team,
      dayCount: teamScores.filter((score) => score.cleanliness_score != null || score.attendance_score != null).length,
      cleanliness,
      management,
      total: cleanliness == null || management == null ? null : cleanliness + management
    };
  });
  return { dailyRows, summaryRows };
}

function addDocumentHeading(sheet, title, periodLabel, columnCount) {
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Tahoma', size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.green900 } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell(2, 1).value = `ช่วงข้อมูล: ${periodLabel}`;
  sheet.mergeCells(3, 1, 3, columnCount);
  sheet.getCell(3, 1).value = `สร้างไฟล์เมื่อ: ${new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok'
  }).format(new Date())}`;
  [2, 3].forEach((rowNumber) => {
    const cell = sheet.getCell(rowNumber, 1);
    cell.font = { name: 'Tahoma', size: 10, color: { argb: COLORS.muted } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  sheet.getRow(4).height = 8;
}

function styleHeader(sheet, headerRowNumber) {
  const row = sheet.getRow(headerRowNumber);
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.green700 } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
}

function styleDataRows(sheet, startRow, endRow, dateColumn, scoreColumns, teamColumn = 1) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 25;
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Tahoma', size: 10, color: { argb: COLORS.ink } };
      cell.alignment = { vertical: 'middle', horizontal: scoreColumns.includes(columnNumber) ? 'right' : 'left' };
      cell.border = thinBorder;
      if (rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F7F9F6' } };
    });
    if (dateColumn) row.getCell(dateColumn).numFmt = 'dd/mm/yyyy';
    scoreColumns.forEach((columnNumber) => { row.getCell(columnNumber).numFmt = '0.00'; });
    const team = row.getCell(teamColumn);
    team.font = { ...team.font, bold: true };
  }
}

function addSummarySheet(workbook, options, summaryRows) {
  const { metrics, periodLabel } = options;
  const sheet = workbook.addWorksheet('สรุปผล', { properties: { tabColor: { argb: COLORS.green700 } } });
  const columns = [
    { header: 'คณะสี', key: 'team', width: 24 },
    { header: 'สี', key: 'color', width: 14 },
    { header: 'จำนวนวันที่มีคะแนน', key: 'dayCount', width: 18 }
  ];
  if (metrics.includes('cleanliness')) columns.push(
    { header: 'อันดับความสะอาด', key: 'cleanlinessRank', width: 18 },
    { header: 'ความสะอาด /10', key: 'cleanliness', width: 18 }
  );
  if (metrics.includes('management')) columns.push(
    { header: 'อันดับการบริหารจัดการ', key: 'managementRank', width: 23 },
    { header: 'การบริหารจัดการ /10', key: 'management', width: 23 }
  );
  if (metrics.includes('total')) columns.push(
    { header: 'อันดับคะแนนรวม', key: 'totalRank', width: 18 },
    { header: 'คะแนนรวม /20', key: 'total', width: 18 }
  );
  sheet.columns = columns;
  addDocumentHeading(sheet, 'สรุปผลและจัดอันดับคณะสี', periodLabel, columns.length);
  sheet.getRow(5).values = columns.map((column) => column.header);
  styleHeader(sheet, 5);

  const cleanlinessRanks = sortAndRank(summaryRows, 'cleanliness');
  const managementRanks = sortAndRank(summaryRows, 'management');
  const totalRanks = sortAndRank(summaryRows, 'total', ['cleanliness', 'management']);
  const primaryMetric = metrics.includes('total') ? 'total' : metrics[0];
  const orderedRows = [...summaryRows].sort((a, b) => {
    if (a[primaryMetric] == null && b[primaryMetric] == null) return a.team.sort_order - b.team.sort_order;
    if (a[primaryMetric] == null) return 1;
    if (b[primaryMetric] == null) return -1;
    return Number(b[primaryMetric]) - Number(a[primaryMetric]) || a.team.sort_order - b.team.sort_order;
  });

  orderedRows.forEach((row) => {
    const values = {
      team: row.team.short_name,
      color: row.team.color_name,
      dayCount: row.dayCount,
      cleanlinessRank: cleanlinessRanks.get(row.team.id),
      cleanliness: row.cleanliness,
      managementRank: managementRanks.get(row.team.id),
      management: row.management,
      totalRank: totalRanks.get(row.team.id),
      total: row.total
    };
    sheet.addRow(columns.map((column) => values[column.key] ?? null));
  });
  const scoreColumns = columns.map((column, index) => column.key.includes('Rank') || ['dayCount', 'cleanliness', 'management', 'total'].includes(column.key) ? index + 1 : null).filter(Boolean);
  styleDataRows(sheet, 6, sheet.rowCount, null, scoreColumns);
  columns.forEach((column, index) => {
    if (column.key.includes('Rank') || column.key === 'dayCount') sheet.getColumn(index + 1).numFmt = '0';
  });
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: sheet.rowCount, column: columns.length } };
  sheet.views = [{ state: 'frozen', ySplit: 5, activeCell: 'A6' }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

function addDailySheet(workbook, options, teams, dailyRows) {
  const { metrics, periodLabel } = options;
  const columns = [
    { header: 'วันที่', key: 'date', width: 16 },
    { header: 'คณะสี', key: 'team', width: 24 },
    { header: 'สี', key: 'color', width: 14 }
  ];
  if (metrics.includes('cleanliness')) columns.push({ header: 'ความสะอาด /10', key: 'cleanliness', width: 18 });
  if (metrics.includes('management')) columns.push({ header: 'การบริหารจัดการ /10', key: 'management', width: 23 });
  if (metrics.includes('total')) columns.push({ header: 'คะแนนรวม /20', key: 'total', width: 18 });
  const sheet = workbook.addWorksheet('คะแนนรายวัน', { properties: { tabColor: { argb: 'EAB436' } } });
  sheet.columns = columns;
  addDocumentHeading(sheet, 'รายละเอียดคะแนนรายวัน', periodLabel, columns.length);
  sheet.getRow(5).values = columns.map((column) => column.header);
  styleHeader(sheet, 5);

  dailyRows.forEach((score) => {
    const team = teams.find((item) => item.id === score.team_id);
    if (!team) return;
    const cleanliness = score.cleanliness_score == null ? null : Number(score.cleanliness_score);
    const management = score.attendance_score == null ? null : Number(score.attendance_score);
    const values = {
      date: excelDate(score.score_date),
      team: team.short_name,
      color: team.color_name,
      cleanliness,
      management,
      total: cleanliness == null || management == null ? null : cleanliness + management
    };
    sheet.addRow(columns.map((column) => values[column.key] ?? null));
  });
  const scoreColumns = columns.map((column, index) => ['cleanliness', 'management', 'total'].includes(column.key) ? index + 1 : null).filter(Boolean);
  styleDataRows(sheet, 6, sheet.rowCount, 1, scoreColumns, 2);
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: sheet.rowCount, column: columns.length } };
  sheet.views = [{ state: 'frozen', ySplit: 5, activeCell: 'A6' }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

export async function createAdminSummaryWorkbook(options) {
  const ExcelJSImport = await import('exceljs');
  const ExcelJS = ExcelJSImport.default || ExcelJSImport;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cleanliness System';
  workbook.company = 'โรงเรียนเทพศิรินทร์ นนทบุรี';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const { dailyRows, summaryRows } = normalizeData(options.teams, options.scores);
  if (options.includeSummary) addSummarySheet(workbook, options, summaryRows);
  if (options.includeDaily) addDailySheet(workbook, options, options.teams, dailyRows);
  return workbook;
}

export async function downloadAdminSummaryExcel(options) {
  const workbook = await createAdminSummaryWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
