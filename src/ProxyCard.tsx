import { Check, Clock3, Languages, Layers3, Music2, RotateCcw, X } from 'lucide-react';
import type { ProxyEvent } from './lyricsService';
import type { SpotifyLookup } from './SpotifyLyrics';

export function ProxyCard({ title, events, spotifyLookup, onRefresh, onClear }: { title: string; events: ProxyEvent[]; spotifyLookup?: SpotifyLookup | null; onRefresh: () => void; onClear: () => void }) {
  const latest = events[0];
  const spotify = spotifyLookup !== undefined;
  const tone = spotify ? spotifyLookup?.kind === 'error' ? 'error' : 'miss' : latest?.kind === 'hit' ? 'hit' : latest?.kind === 'missing' ? 'error' : 'miss';
  const label = spotify ? spotifyLookup?.kind === 'error' ? 'Letra indisponível' : spotifyLookup ? 'Consulta concluída' : 'Consultando LRCLIB' : tone === 'hit' ? 'Cache Hit' : tone === 'error' ? 'Letra indisponível' : 'Cache Miss';
  const detail = spotify ? 'Letra do LRCLIB; tradução via MyMemory' : tone === 'hit' ? 'Letra e tradução obtidas do cache' : tone === 'error' ? 'O serviço local não encontrou esta faixa' : 'Consulta ao serviço local concluída';
  return <section className="proxy-card" aria-label="Proxy Engine">
    <div className="card-head"><span className="icon-square"><Layers3 size={22}/></span><div><h3>Proxy Engine</h3><p>Controle e cache de letras e traduções</p></div></div>
    <div className={`status ${tone}`}><span className="status-icon">{tone === 'error' ? <X size={18}/> : <Check size={18}/>}</span><div><strong>{label}</strong><small>{detail}</small></div><span className="latency">{spotify ? spotifyLookup ? `${spotifyLookup.durationMs} ms` : '…' : `${latest?.durationMs ?? 0} ms`}</span></div>
    <div className="proxy-metadata">
      <div><Music2 size={17}/><span>Música</span><strong>{title}</strong></div>
      <div><Layers3 size={17}/><span>Serviço</span><strong>{spotify ? 'LRCLIB + MyMemory' : 'LyricsService local'}</strong></div>
      <div><Languages size={17}/><span>Idioma original</span><strong>Inglês (EN)</strong></div>
      <div><Languages size={17}/><span>Tradução</span><strong>Português (PT-BR)</strong></div>
    </div>
    <div className="proxy-actions"><button onClick={onRefresh}>Consultar novamente</button><button onClick={onClear} title="Limpar cache" aria-label="Limpar cache"><RotateCcw size={16}/></button></div>
    <details className="recent-activity"><summary><Clock3 size={15}/> Atividade recente</summary><div className="events">{spotify ? spotifyLookup && <div><span className={`event-dot ${spotifyLookup.kind}`}/><span>{label}</span><time>{spotifyLookup.at}</time></div> : events.slice(0, 5).map((event, i) => <div key={`${event.at}-${i}`}><span className={`event-dot ${event.kind}`}/><span>{event.kind === 'hit' ? 'Cache Hit' : event.kind === 'miss' ? 'Cache Miss' : 'Letra indisponível'}</span><time>{event.at}</time></div>)}</div></details>
  </section>;
}
