import { EMOJIS, mergeParticipants, type Participant } from './scoreboard.ts';
export function practiceParticipants(): Participant[] {
  return ['Alex', 'Sam', 'Jordan', 'Riley'].map((name, index) => ({ id: `practice-${index}`, name, count: [8, 8, 6, 0][index], version: 0, created_at: index }));
}
export function adjustPractice(participants: Participant[], id: string, delta: number) {
  if (delta !== 1 && delta !== -1) throw new Error('Use +1 or −1.');
  if (!participants.some(p => p.id === id)) throw new Error('Choose an existing practice participant.');
  return mergeParticipants([], participants.map(p => p.id === id ? { ...p, count: Math.max(0, p.count + delta), version: p.version + 1 } : p));
}
export function addPractice(participants: Participant[], input: string, id: string) {
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name || [...name].length > 32) throw new Error('Use a name with 1–32 characters.');
  if (participants.length >= 12) throw new Error('This practice table has room for 12 people.');
  if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is already at this practice table.');
  return mergeParticipants([], [...participants, { id, name, count: 0, version: 0, created_at: Date.now() }]);
}
export { EMOJIS };
