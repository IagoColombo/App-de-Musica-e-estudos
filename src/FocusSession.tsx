import { ArrowRight, Clock3, ListMusic, Pause, Play, Settings2, ShieldCheck, Square, Target } from 'lucide-react';
import { formatTime } from './data';
import { FocusBlocking } from './FocusBlocking';

type Props = {
  enabled: boolean;
  running: boolean;
  seconds: number;
  minutes: number;
  songTitle: string;
  blocked: string[];
  onToggle: () => void;
  onToggleRunning: () => void;
  onStop: () => void;
  onMinutes: (value: number) => void;
  onSettings: () => void;
};

export function FocusSession({ enabled, running, seconds, minutes, songTitle, blocked, onToggle, onToggleRunning, onStop, onMinutes, onSettings }: Props) {
  return <section className="focus-card" aria-label="Sessão de foco">
    <div className="focus-top"><div className="focus-title"><span className="focus-icon"><Target size={22}/></span><div><h3>Sessão de foco <small>{running ? '(ativa)' : enabled ? '(pronta)' : ''}</small></h3></div></div><button className="focus-settings" onClick={onSettings} aria-label="Configurar sessão de foco"><Settings2 size={19}/></button></div>
    <button className="focus-playlist" onClick={onSettings}><span className="playlist-cover"><ListMusic size={22}/></span><span><strong>Faixa de foco</strong><small>{songTitle}</small></span><ArrowRight size={18}/></button>
    <div className="focus-timer"><Clock3 size={26}/><div><strong>{formatTime(seconds)}</strong><small>restantes</small></div><button className="timer-primary" onClick={() => { if (!enabled) onToggle(); onToggleRunning(); }} aria-label={running ? 'Pausar sessão' : 'Iniciar sessão'}>{running ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><button className="timer-stop" onClick={onStop} disabled={!enabled} aria-label="Parar sessão"><Square size={18}/></button></div>
    <button className="limit-row" onClick={onSettings}><ShieldCheck size={21}/><span>Apps e sites limitados<small>{blocked.length} sites na lista de bloqueio</small></span><ArrowRight size={17}/></button>
    <div className="focus-options"><label>Duração <input type="number" min="1" max="240" value={minutes} onChange={event => onMinutes(Number(event.target.value))} disabled={running} aria-label="Duração em minutos"/> min</label><button className="focus-enabled" role="switch" aria-checked={enabled} onClick={onToggle}>{enabled ? 'Modo ativo' : 'Ativar modo'}</button></div>
    <FocusBlocking active={enabled && running && seconds > 0} domains={blocked}/>
  </section>;
}
