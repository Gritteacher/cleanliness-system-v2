export function reportTeacherNames(report) {
  const names = Array.isArray(report?.teacher_names) ? report.teacher_names.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()) : [];
  if (names.length) return names;
  return report?.teacher_name ? [report.teacher_name] : [];
}

export function enteredTeacherNames(names) {
  return names.map(name => name.trim()).filter(Boolean);
}

export const MAX_PRACTICE_TEACHERS = 4;

export function draftTeacherNames(names = []) {
  const result = [...names].slice(0, MAX_PRACTICE_TEACHERS);
  while (result.length < 2) result.push('');
  return result;
}

export function applyRosterNames(draft, names) {
  // A late network response must not replace names the teacher already edited.
  return draft.namesTouched ? draft : { ...draft, names: draftTeacherNames(names) };
}
