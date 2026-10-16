import test from 'node:test';
import assert from 'node:assert/strict';
import { standings, standingsCsv, SnapshotGate } from '../lib/standings.ts';
import { practiceParticipants, adjustPractice, addPractice } from '../lib/practice.ts';
test('standings use competition ranks and exact shares without dividing by zero', () => {
  const summary = standings(practiceParticipants());
  assert.deepEqual(summary.rows.map(p => p.rank), [1, 1, 3, 4]);
  assert.equal(summary.total, 22); assert.equal(summary.leaders.length, 2);
  assert.equal(summary.rows[2].behind, 2);
  assert.equal(summary.rows.reduce((sum, p) => sum + p.share, 0), 1);
  assert.equal(standings([{ ...practiceParticipants()[0], count: 0 }]).rows[0].share, 0);
  assert.deepEqual(standings([]).leaders, []);
});
test('CSV quotes names, preserves Unicode, and neutralizes spreadsheet formulas', () => {
  const names = ['=HYPERLINK("bad")', '  +cmd', '@command', '-bad', '\tbad', 'Lee, "Sushi" 🍣'];
  const people = names.map((name, i) => ({ id: String(i), name, count: i, version: 1, created_at: i, privateToken: 'never-export-this' }));
  const csv = standingsCsv(people, 'PRACTICE', 0);
  assert.match(csv, /"'  \+cmd"/); assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Lee, ""Sushi"" 🍣"/); assert.match(csv, /1970-01-01T00:00:00.000Z/);
  assert.ok(!csv.includes('never-export-this')); assert.ok(csv.endsWith('\r\n'));
});
test('practice adjustments stay nonnegative and validate player names', () => {
  const sample = practiceParticipants();
  const changed = adjustPractice(sample, 'practice-3', -1);
  assert.equal(changed.find(p => p.id === 'practice-3').count, 0);
  assert.equal(sample[3].version, 0);
  assert.throws(() => adjustPractice(sample, 'missing', 1));
  assert.throws(() => adjustPractice(sample, 'practice-0', 100));
  assert.throws(() => addPractice(sample, ' alex ', 'new'));
  assert.throws(() => addPractice(sample, ' ', 'new'));
  assert.equal(addPractice(sample, ' New   Player ', 'new').at(-1).name, 'New Player');
});
test('snapshot gate ignores old responses after writes and newer completed reads', () => {
  const gate = new SnapshotGate(); const beforeWrite = gate.begin();
  gate.invalidate(); assert.equal(gate.accepts(beforeWrite), false);
  const duringWrite = gate.begin(); gate.invalidate(); assert.equal(gate.accepts(duringWrite), false);
  const first = gate.begin(), second = gate.begin();
  assert.equal(gate.accepts(second), true); assert.equal(gate.accepts(first), false);
});
test('slow reads still make progress when polling starts a newer request', () => {
  const gate = new SnapshotGate(); const first = gate.begin(), second = gate.begin();
  assert.equal(gate.accepts(first), true); assert.equal(gate.accepts(second), true);
});
