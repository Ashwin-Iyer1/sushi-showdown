import { useState } from 'react';
import { Plus, Minus, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TableTools } from './table-tools';
import { practiceParticipants, adjustPractice, addPractice } from '../lib/practice';
import { standings } from '../lib/standings';
export function PracticeTable({ onExit }: { onExit: () => void }) {
  const [participants, setParticipants] = useState(practiceParticipants);
  const [display, setDisplay] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [capturedAt, setCapturedAt] = useState(Date.now);
  const summary = standings(participants);
  const adjust = (id: string, delta: number) => { setParticipants(current => adjustPractice(current, id, delta)); setCapturedAt(Date.now()); };
  return <main className={`scoreboard-shell practice-shell ${display ? 'display-mode' : ''}`}>
    <header className="masthead"><span className="wordmark"><span className="wordmark-icon">S.</span><span>SUSHI<br/>SHOWDOWN</span></span><Button variant="ghost" onClick={onExit}><ArrowLeft size={17}/>Real rooms</Button></header>
    <div className="title-row"><div><p className="eyebrow">PRACTICE TABLE · FICTIONAL PARTICIPANTS</p><h1>A friendly first round.</h1></div><span className="practice-badge">LOCAL DEMO</span></div>
    <p className="practice-note">Try the controls, explore a tie, or put the standings on a big screen. Changes stay in this tab and reset on reload. This table creates no room, sends no scores, and cannot be shared with players.</p>
    <section className="stats" aria-label="Practice totals"><div className="total-card"><div><p className="stat-label">PRACTICE SUSHI EATEN</p><p className="total-number">{summary.total}<span>pieces</span></p></div><img className="sushi-photo" src="/sushi.jpg" alt="Two salmon nigiri on a black plate" width="160" height="160"/></div><div className="people-card"><span className="people-number">{participants.length}</span><span className="people-label">fictional players</span></div></section>
    <TableTools participants={participants} room="PRACTICE" display={display} onDisplay={() => setDisplay(value => !value)} capturedAt={capturedAt}/>
    <div className="workspace"><aside className="join-panel"><span className="section-marker">PLAY WITH THE TABLE</span><h2>Make it your own.</h2><p>You control every practice score. Real rooms enforce host and player permissions on the server.</p><form onSubmit={event => { event.preventDefault(); try { setParticipants(addPractice(participants, name, crypto.randomUUID())); setName(''); setMessage('Practice player added.'); setCapturedAt(Date.now()); } catch (error) { setMessage((error as Error).message); } }}><label htmlFor="practice-name">Practice nickname</label><Input id="practice-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} required/><Button className="join-button" type="submit"><Plus size={17}/>Add practice player</Button></form><Button variant="outline" className="copy-link" onClick={() => { setParticipants(practiceParticipants()); setCapturedAt(Date.now()); setMessage('Practice table reset.'); }}><RotateCcw size={16}/>Reset practice table</Button><p className="helper">The CSV export contains this fictional table's current snapshot. It never contains room credentials.</p><p role="status" className="practice-message">{message}</p></aside>
    <section className="board-panel" aria-labelledby="practice-board-title"><div className="board-heading"><div><span className="section-marker">THE STANDINGS</span><h2 id="practice-board-title">Practice leaderboard</h2></div></div><ol className="participants">{summary.rows.map(p => <li key={p.id} className={`participant ${p.rank === 1 && p.count > 0 ? 'leader' : ''}`}><span className="rank" aria-label={`Rank ${p.rank}`}>{String(p.rank).padStart(2,'0')}</span><div className="participant-name"><span>{p.name}</span>{p.rank === 1 && p.count > 0 ? <small>{summary.leaders.length > 1 ? 'TIED FOR THE LEAD' : 'LEADING'}</small> : p.behind > 0 ? <small>{p.behind} BEHIND THE LEAD</small> : null}</div><div className="score-controls">{!display && <Button className="count-button subtract" variant="outline" disabled={p.count === 0} aria-label={`Subtract one sushi from ${p.name}`} onClick={() => adjust(p.id,-1)}><Minus/></Button>}<div className="participant-count" aria-label={`${p.count} sushi`}>{p.count}<span>sushi</span></div>{!display && <Button className="count-button add" aria-label={`Add one sushi to ${p.name}`} onClick={() => adjust(p.id,1)}><Plus/></Button>}</div></li>)}</ol><div className="board-footer"><span>Fictional scores · browser only</span><span>Ties share the same rank</span></div></section></div>
    <footer className="page-footer"><span>SUSHI SHOWDOWN</span><span>Practice the controls, then invite your real table.</span></footer>
  </main>;
}
