import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceSchedule, practiceDefaultDate, PRACTICE_TEAMS } from '../src/utils/practiceSchedule.js';
test('all five colors have distinct IDs', () => assert.equal(new Set(PRACTICE_TEAMS.map(t => t.id)).size, 5));
test('weekday cutoff changes on 16 November', () => {
  assert.equal(practiceSchedule('2026-11-02').end,'19:00');
  assert.equal(practiceSchedule('2026-11-13').end,'19:00');
  assert.equal(practiceSchedule('2026-11-16').end,'20:00');
  assert.equal(practiceSchedule('2026-11-30').end,'20:00');
});
test('weekends override both periods', () => {
  for(const date of ['2026-11-08','2026-11-14','2026-11-15','2026-11-21','2026-11-22','2026-11-28','2026-11-29']) {
    assert.equal(practiceSchedule(date).start,'08:00'); assert.equal(practiceSchedule(date).end,'16:00');
  }
});
test('7 November is closed and range enforced', () => {
  for(const date of ['2026-11-07','2026-11-01','2026-12-01','2026-11-31','',null]) assert.equal(practiceSchedule(date).enabled,false);
});
test('28 required days, 140 expected color/day reports', () => {
  const days=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`).filter(d=>practiceSchedule(d).enabled);
  assert.equal(days.length,28); assert.equal(days.length*PRACTICE_TEAMS.length,140);
});
test('default date is in reporting period', () => {
  assert.equal(practiceDefaultDate('2026-10-28'),'2026-11-02');assert.equal(practiceDefaultDate('2026-11-14'),'2026-11-14');assert.equal(practiceDefaultDate('2026-12-01'),'2026-11-30');
});
