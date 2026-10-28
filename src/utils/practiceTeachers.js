export function reportTeacherNames(report) {
  const names = Array.isArray(report?.teacher_names) ? report.teacher_names.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()) : [];
  if (names.length) return names;
  return report?.teacher_name ? [report.teacher_name] : [];
}

export function enteredTeacherNames(names) {
  return names.map(name => name.trim()).filter(Boolean);
}
