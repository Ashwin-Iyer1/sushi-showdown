import { mergeParticipants, type Participant } from './scoreboard.ts';
export function standings(participants: Participant[]) {
  const sorted = mergeParticipants([], participants);
  const total = sorted.reduce((sum, p) => sum + p.count, 0);
  const top = sorted[0]?.count ?? 0;
  return { total, leaders: top > 0 ? sorted.filter(p => p.count === top) : [],
    rows: sorted.map(p => ({ ...p, rank: sorted.findIndex(other => other.count === p.count) + 1, share: total ? p.count / total : 0, behind: top - p.count })) };
}
function cell(value: unknown) {
  const text = String(value);
  // Quote every cell and neutralize spreadsheet formulas, including leading whitespace.
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function standingsCsv(participants: Participant[], room: string, capturedAt: number) {
  const rows: unknown[][] = [['Room', 'Captured at (UTC)', 'Rank', 'Participant', 'Pieces']];
  const timestamp = new Date(capturedAt).toISOString();
  for (const p of standings(participants).rows) rows.push([room, timestamp, p.rank, p.name, p.count]);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** An older response cannot replace a newer completed read or a completed write. */
export class SnapshotGate {
  private epoch = 0;
  private latest = 0;
  private applied = 0;
  invalidate() { this.epoch++; }
  begin() { return { epoch: this.epoch, request: ++this.latest }; }
  accepts(ticket: { epoch: number; request: number }) {
    if (ticket.epoch !== this.epoch || ticket.request < this.applied) return false;
    this.applied = ticket.request;
    return true;
  }
}
