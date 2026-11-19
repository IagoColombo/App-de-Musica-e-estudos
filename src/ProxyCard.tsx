import { Clock3, Languages, Layers3, Music2, RotateCcw } from 'lucide-react';
import type { ProxyEvent } from './lyricsService';
import type { SpotifyLookup } from './SpotifyLyrics';
import { SignalChain } from './SignalChain';

export function ProxyCard({ title, events, spotifyLookup, onRefresh, onClear }: { title: string; events: ProxyEvent[]; spotifyLookup?: SpotifyLookup | null; onRefresh: () => void; onClear: () => void }) {
  const latest = events[0];
  const spotify = spotifyLookup !== undefined;
  const tone = spotify ? spotifyLookup?.kind === 'error' ? 'error' : 'miss' : latest?.kind === 'hit' ? 'hit' : latest?.kind === 'missing' ? 'error' : 'miss';
  const label = spotify ? spotifyLookup?.kind === 'error' ? 'Letra indisponível' : spotifyLookup ? 'Consulta concluída' : 'Consultando LRCLIB' : tone === 'hit' ? 'Cache Hit' : tone === 'error' ? 'Letra indisponível' : 'Cache Miss';
  const route = tone === 'error' ? 'error' : spotify ? spotifyLookup ? 'external' : 'idle' : !latest ? 'idle' : tone === 'hit' ? 'cache' : 'local';
  const latency = spotify ? spotifyLookup?.durationMs : latest?.durationMs;
  return <section className="proxy-card" aria-label="Proxy Engine">
    <div className="card-head"><span className="icon-square"><Layers3 size={22}/></span><div><h3>Proxy Engine</h3><p>Controle e cache de letras e traduções</p></div></div>
    <SignalChain route={route} latency={latency} label={route === 'idle' && !spotify ? 'Aguardando consulta' : label} revision={`${title}-${spotifyLookup?.at ?? latest?.at ?? ''}`}/>
    <details className="proxy-details"><summary>Detalhes da consulta</summary><div className="proxy-metadata">
      <div><Music2 size={17}/><span>Música</span><strong>{title}</strong></div>
      <div><Layers3 size={17}/><span>Serviço</span><strong>{spotify ? 'LRCLIB + MyMemory' : 'LyricsService local'}</strong></div>
      <div><Languages size={17}/><span>Idioma original</span><strong>Inglês (EN)</strong></div>
      <div><Languages size={17}/><span>Tradução</span><strong>Português (PT-BR)</strong></div>
    </div></details>
    <div className="proxy-actions"><button onClick={onRefresh}>Consultar novamente</button><button onClick={onClear} title="Limpar cache" aria-label="Limpar cache"><RotateCcw size={16}/></button></div>
    <details className="recent-activity"><summary><Clock3 size={15}/> Atividade recente</summary><div className="events">{spotify ? spotifyLookup && <div><span className={`event-dot ${spotifyLookup.kind}`}/><span>{label}</span><time>{spotifyLookup.at}</time></div> : events.slice(0, 5).map((event, i) => <div key={`${event.at}-${i}`}><span className={`event-dot ${event.kind}`}/><span>{event.kind === 'hit' ? 'Cache Hit' : event.kind === 'miss' ? 'Cache Miss' : 'Letra indisponível'}</span><time>{event.at}</time></div>)}</div></details>
  </section>;
}
