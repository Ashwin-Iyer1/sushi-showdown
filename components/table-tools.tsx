import { Download, Monitor, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import type { Participant } from '../lib/scoreboard';
import { standings, standingsCsv } from '../lib/standings';
export function TableTools({ participants, room, display, onDisplay, capturedAt, offline = false }: { participants: Participant[]; room: string; display: boolean; onDisplay: () => void; capturedAt: number; offline?: boolean }) {
  const summary = standings(participants);
  const download = () => {
    const blob = new Blob([standingsCsv(participants, room, capturedAt)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `sushi-${room.toLowerCase()}-standings.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="table-tools" aria-label="Table display and export">
    <div className="table-insight"><span className="section-marker">AT A GLANCE</span><p>{summary.leaders.length === 0 ? 'The first piece is still up for grabs.' : summary.leaders.length > 1 ? `${summary.leaders.length} people tied for the lead at ${summary.leaders[0].count} pieces.` : `${summary.leaders[0].name} leads with ${summary.leaders[0].count} pieces.`}</p><small>{offline ? 'Last received snapshot' : 'Snapshot received'} {new Date(capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · CSV exports this snapshot, without control links.</small></div>
    <div className="table-tool-buttons"><Button variant="outline" onClick={onDisplay} aria-pressed={display}>{display ? <SlidersHorizontal size={17}/> : <Monitor size={17}/>} {display ? 'Return to controls' : 'Table display'}</Button><Button variant="outline" onClick={download} disabled={!participants.length}><Download size={17}/>Download standings</Button></div>
  </section>;
}
