import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Album, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Disc3, Heart, Home, ListMusic, Music2, Pause, Play, RotateCcw, Search, Settings2, ShieldCheck, SkipBack, SkipForward, Sparkles, Target, Volume2, X } from 'lucide-react';
import { formatTime, songs } from './data';
import { lyricsProxy, type ProxyEvent } from './lyricsService';
import { recognizeMusicLink, type MusicSource } from './sourceRecognition';
import { SpotifyPanel } from './SpotifyPanel';

gsap.registerPlugin(ScrollTrigger, useGSAP);
const nav = [{ label: 'Início', icon: Home }, { label: 'Buscar', icon: Search }, { label: 'Biblioteca', icon: Album }, { label: 'Histórico', icon: Clock3 }, { label: 'Favoritos', icon: Heart }];

function App() {
  const [songIndex, setSongIndex] = useState(0);
  const song = songs[songIndex];
  const [position, setPosition] = useState(42);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [focus, setFocus] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(() => Math.min(240, Math.max(1, Number(localStorage.getItem('lyra:focusMinutes')) || 45)) * 60);
  const [focusMinutes, setFocusMinutes] = useState(() => Math.min(240, Math.max(1, Number(localStorage.getItem('lyra:focusMinutes')) || 45)));
  const [musicLink, setMusicLink] = useState('');
  const [recognizedSource, setRecognizedSource] = useState<MusicSource | null>(null);
  const [linkError, setLinkError] = useState('');
  const [blocked, setBlocked] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:blocked') || '["instagram.com","tiktok.com"]'));
  const [showRules, setShowRules] = useState(false);
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [lyrics, setLyrics] = useState(song.lines);
  const [activeNav, setActiveNav] = useState('Início');
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:favorites') || '[]'));
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:history') || '[]'));
  const [focusSong, setFocusSong] = useState(() => localStorage.getItem('lyra:focusSong') || songs[0].id);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAudio = Boolean(audioUrls[song.id]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const duration = hasAudio && audioDuration ? audioDuration : song.duration;
  const root = useRef<HTMLDivElement>(null);
  const lyricList = useRef<HTMLDivElement>(null);
  const current = lyrics.reduce((index, line, i) => position >= line.at ? i : index, 0);

  useEffect(() => {
    setLyrics(lyricsProxy.getLyrics(song.id) ?? []);
    setEvents(lyricsProxy.history());
    document.documentElement.style.setProperty('--song-accent', song.accent);
  }, [song.id, song.accent]);

  useEffect(() => { localStorage.setItem('lyra:favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('lyra:history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('lyra:focusSong', focusSong); }, [focusSong]);
  useEffect(() => { localStorage.setItem('lyra:blocked', JSON.stringify(blocked)); }, [blocked]);
  useEffect(() => { localStorage.setItem('lyra:focusMinutes', String(focusMinutes)); }, [focusMinutes]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    audio.volume = volume / 100;
    if (playing) audio.play().catch(() => setPlaying(false)); else audio.pause();
  }, [playing, hasAudio, song.id, volume]);
  useEffect(() => {
    if (!playing || hasAudio) return;
    const timer = window.setInterval(() => setPosition(p => p >= duration ? (setPlaying(false), 0) : p + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing, hasAudio, duration]);

  useEffect(() => {
    if (!focusRunning || !focus) return;
    const timer = window.setInterval(() => setFocusSeconds(s => s > 0 ? s - 1 : (setFocusRunning(false), 0)), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning, focus]);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.intro', { autoAlpha: 0, y: 16, duration: .65, ease: 'power2.out', stagger: .08 });
      if (lyricList.current) gsap.utils.toArray<HTMLElement>('.lyric').forEach(el => {
        gsap.from(el, { autoAlpha: 0, y: 14, duration: .45, ease: 'power1.out', scrollTrigger: { trigger: el, scroller: lyricList.current!, start: 'top 90%', once: true } });
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [song.id] });

  useEffect(() => {
    const el = lyricList.current?.querySelector<HTMLElement>('.lyric.active');
    if (el && playing) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [current, playing]);

  function changeSong(next: number) {
    setSongIndex((next + songs.length) % songs.length);
    setPosition(0);
    setPlaying(false);
    setQuery('');
    setAudioDuration(null);
    const id = songs[(next + songs.length) % songs.length].id;
    setHistory(old => [id, ...old.filter(item => item !== id)].slice(0, 20));
  }
  function importAudio(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { alert('Escolha um arquivo de áudio.'); return; }
    setAudioUrls(old => {
      if (old[song.id]) URL.revokeObjectURL(old[song.id]);
      return { ...old, [song.id]: URL.createObjectURL(file) };
    });
    setPosition(0); setPlaying(false); setAudioDuration(null);
  }
  function seek(value: number) {
    setPosition(value);
    if (hasAudio && audioRef.current) audioRef.current.currentTime = value;
  }
  function toggleFavorite() { setFavorites(old => old.includes(song.id) ? old.filter(id => id !== song.id) : [...old, song.id]); }
  function consultAgain() { setLyrics(lyricsProxy.getLyrics(song.id) ?? []); setEvents(lyricsProxy.history()); }
  function clearCache() { lyricsProxy.clear(); setEvents([]); }
  function toggleFocus() { setFocus(value => { if (value) setFocusRunning(false); return !value; }); }
  function updateFocusMinutes(value: number) {
    const minutes = Math.min(240, Math.max(1, Math.round(value || 1)));
    setFocusMinutes(minutes);
    setFocusRunning(false);
    setFocusSeconds(minutes * 60);
  }
  function detectMusicLink() {
    const source = recognizeMusicLink(musicLink);
    setRecognizedSource(source);
    setLinkError(source ? '' : 'Cole o link de uma faixa do Spotify ou de um vídeo do YouTube.');
  }
  const shownSongs = songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="app" ref={root}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i/><i/><i/><i/><i/></span><b>LyraFlow</b></div>
      <div className="side-group">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'selected' : ''}`} onClick={() => { setActiveNav(label); if (label === 'Buscar') document.querySelector<HTMLInputElement>('.search input')?.focus(); }}><Icon size={19}/>{label}</button>)}</div>
      <div className="side-rule"/><div className="side-caption">SUA MÚSICA</div>
      <button className="nav-item" onClick={() => changeSong(0)}><Disc3 size={19}/> Em reprodução</button>
      <button className="nav-item" onClick={() => setActiveNav('Biblioteca')}><ListMusic size={19}/> Faixas locais</button>
      <div className="sidebar-bottom"><span className="demo-pill"><span className="live-dot"/> DEMONSTRAÇÃO LOCAL</span><button className="nav-item" onClick={() => setShowRules(true)}><Settings2 size={19}/> Configurações</button></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="history-buttons"><button aria-label="Voltar" onClick={() => changeSong(songIndex - 1)}><ArrowLeft size={18}/></button><button aria-label="Avançar" onClick={() => changeSong(songIndex + 1)}><ArrowRight size={18}/></button></div>
        <div className="search-wrap"><label className="search"><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar música ou artista..."/></label>{query && <div className="search-results">{shownSongs.length ? shownSongs.map((s) => <button key={s.id} onClick={() => changeSong(songs.indexOf(s))}><Music2 size={16}/><span>{s.title}<small>{s.artist}</small></span></button>) : <p>Nenhuma faixa local encontrada.</p>}</div>}</div>
        <div className="top-right"><span className="eyebrow">SEU ESPAÇO PARA OUVIR</span><span className="avatar">L</span></div></header>
      <div className="content">
        {activeNav !== 'Início' && activeNav !== 'Buscar' && <div className="collection"><div><p className="eyebrow">SUA BIBLIOTECA</p><h2>{activeNav}</h2></div><div className="collection-list">{(activeNav === 'Favoritos' ? songs.filter(s => favorites.includes(s.id)) : activeNav === 'Histórico' ? history.map(id => songs.find(s => s.id === id)).filter((s): s is typeof songs[number] => Boolean(s)) : songs).map(s => <button key={s.id} onClick={() => { changeSong(songs.indexOf(s)); setActiveNav('Início'); }}><Music2 size={17}/><span>{s.title}<small>{s.artist}</small></span><ArrowRight size={15}/></button>)}{activeNav === 'Favoritos' && favorites.length === 0 && <p>Nenhuma faixa favorita ainda.</p>}{activeNav === 'Histórico' && history.length === 0 && <p>O histórico aparece após você escolher uma faixa.</p>}</div></div>}
        <section className="page-heading intro"><div><p className="eyebrow accent-text">MÚSICA EM FOCO</p><h1>Deixe a música falar.</h1></div><span className="source-pill"><span className="live-dot"/> Biblioteca local <ChevronDown size={14}/></span></section>
        {focus && <label className="focus-select">Faixa escolhida para foco <select value={focusSong} onChange={e => { setFocusSong(e.target.value); changeSong(songs.findIndex(s => s.id === e.target.value)); }}>{songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
        <div className="workspace">
          <section className="player-column intro"><div className={`artwork art-${song.id}`}><div className="art-halo"/><div className="art-sun"/><div className="art-hill one"/><div className="art-hill two"/><div className="art-grain"/><div className="art-label"><span>LYRAFLOW SESSIONS</span><strong>{song.album}</strong></div></div>
            <div className="song-title"><div><p className="eyebrow">TOCANDO AGORA</p><h2>{song.title}</h2><p>{song.artist} <span>·</span> {song.album}</p></div><button className={`icon-button ${favorites.includes(song.id) ? 'favorited' : ''}`} aria-label="Favorito" onClick={toggleFavorite}><Heart size={22} fill={favorites.includes(song.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="player-progress"><input aria-label="Posição da música" type="range" min="0" max={duration} value={position} onChange={e => seek(Number(e.target.value))} style={{'--range': `${position / duration * 100}%`} as React.CSSProperties}/><div><span>{formatTime(position)}</span><span>{formatTime(duration)}</span></div></div>
            <div className="controls"><button aria-label="Faixa anterior" onClick={() => changeSong(songIndex - 1)}><SkipBack size={21} fill="currentColor"/></button><button className="play-button" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}</button><button aria-label="Próxima faixa" onClick={() => changeSong(songIndex + 1)}><SkipForward size={21} fill="currentColor"/></button></div>
            <div className="volume"><Volume2 size={17}/><input aria-label="Volume de demonstração" type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} style={{'--range': `${volume}%`} as React.CSSProperties}/><span>{volume}%</span></div>
            <div className="local-note"><Music2 size={16}/><span>{hasAudio ? 'Áudio local associado a esta faixa' : 'Sem áudio: reprodução simulada'}</span></div>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => importAudio(e.target.files?.[0])}/><button className="audio-import" onClick={() => fileRef.current?.click()}>Associar áudio local a esta faixa</button>
            <audio ref={audioRef} src={audioUrls[song.id]} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e => setAudioDuration(e.currentTarget.duration)} onEnded={() => setPlaying(false)}/>
          </section>
          <section className="lyrics-column intro"><div className="panel-heading"><div><h2>Letra e tradução</h2></div><button className="font-button" title="Tamanho da letra" onClick={() => document.querySelector('.lyrics-column')?.classList.toggle('large-type')}>Aa</button></div>
            <div className="lyric-list" ref={lyricList}>{lyrics.map((line, i) => <button key={line.at} className={`lyric ${i === current ? 'active' : ''}`} onClick={() => seek(line.at)}><span className="lyric-time">{formatTime(line.at)}</span><strong>{line.original}</strong><em>{line.translation}</em></button>)}</div><div className="lyrics-footer"><Sparkles size={15}/> Toque em um verso para avançar a prévia</div>
          </section>
          <aside className="right-column intro"><SpotifyPanel/><div className="source-card"><h3>Reconhecer música</h3><p>Cole um link de faixa do Spotify ou vídeo do YouTube.</p><form onSubmit={e => { e.preventDefault(); detectMusicLink(); }}><input aria-label="Link da música" value={musicLink} onChange={e => setMusicLink(e.target.value)} placeholder="Cole o link aqui"/><button type="submit">Identificar</button></form>{linkError && <small className="source-error">{linkError}</small>}{recognizedSource && <div className="recognized"><div><strong>{recognizedSource.provider} identificado</strong><button onClick={() => { setRecognizedSource(null); setMusicLink(''); }} aria-label="Remover link"><X size={15}/></button></div><iframe title={`Player ${recognizedSource.provider}`} src={recognizedSource.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy"/><a href={recognizedSource.url} target="_blank" rel="noopener noreferrer">Abrir no {recognizedSource.provider} ↗</a><small>Este player é separado da prévia local; letra sincronizada desse link ainda não está disponível.</small></div>}<small className="source-note">Detecção automática em outros apps requer conexão com sua conta ou extensão do navegador.</small></div><div className="proxy-card"><div className="card-head"><div className="icon-square"><Disc3 size={20}/></div><div><p className="eyebrow">POR TRÁS DA MÚSICA</p><h3>Proxy Engine</h3></div></div><div className={`status ${events[0]?.kind ?? 'miss'}`}><Check size={17}/><div><strong>{events[0]?.kind === 'hit' ? 'Cache Hit' : events[0]?.kind === 'missing' ? 'Não encontrada' : 'Cache Miss'}</strong><small>{events[0]?.kind === 'hit' ? 'Letra reutilizada do cache' : 'Consulta ao serviço local'}</small></div></div><div className="proxy-detail"><span>Fonte</span><b>LyricsService local</b></div><div className="proxy-detail"><span>Idioma</span><b>Inglês · Português</b></div><div className="proxy-actions"><button onClick={consultAgain}>Consultar novamente</button><button onClick={clearCache} title="Limpar cache"><RotateCcw size={16}/></button></div><div className="event-title">ATIVIDADE RECENTE</div><div className="events">{events.slice(0, 3).map((e, i) => <div key={`${e.at}-${i}`}><span className={`event-dot ${e.kind}`}/><span>{e.kind === 'hit' ? 'Cache Hit' : e.kind === 'miss' ? 'Cache Miss' : 'Sem letra'}</span><time>{e.at}</time></div>)}</div></div>
            <div className="focus-card"><div className="focus-top"><div className="focus-title"><span className="focus-icon"><Target size={20}/></span><div><h3>Estudo / Trabalho</h3></div></div><button className={`switch ${focus ? 'on' : ''}`} role="switch" aria-checked={focus} aria-label="Ativar modo de foco" onClick={toggleFocus}><span/></button></div>{focus ? <div className="focus-body"><div className="focus-playlist"><ListMusic size={18}/><div><strong>Faixa de foco</strong><small>{songs.find(s => s.id === focusSong)?.title}</small></div></div><label className="duration-field">Duração da sessão <span><input type="number" min="1" max="240" value={focusMinutes} onChange={e => updateFocusMinutes(Number(e.target.value))} aria-label="Duração em minutos"/> min</span></label><div className="duration-presets">{[25, 45, 60, 90].map(minutes => <button key={minutes} className={focusMinutes === minutes ? 'chosen' : ''} onClick={() => updateFocusMinutes(minutes)}>{minutes} min</button>)}</div><div className="focus-timer"><span>{formatTime(focusSeconds)}</span><div><button onClick={() => { if (focusSeconds === 0) setFocusSeconds(focusMinutes * 60); setFocusRunning(!focusRunning); }}>{focusRunning ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}{focusRunning ? 'Pausar' : 'Iniciar'}</button><button className="timer-reset" title="Reiniciar tempo" aria-label="Reiniciar tempo" onClick={() => { setFocusRunning(false); setFocusSeconds(focusMinutes * 60); }}><RotateCcw size={15}/></button></div></div><button className="limit-row" onClick={() => setShowRules(true)}><ShieldCheck size={18}/> {blocked.length} sites na lista de foco <ArrowRight size={15}/></button><p className="focus-hint">A lista ainda não bloqueia sites ou aplicativos.</p></div> : <p className="focus-off">Ative para escolher a faixa e iniciar uma sessão.</p>}</div>
          </aside>
        </div>
      </div>
    </div>
    {showRules && <div className="modal-backdrop" onClick={() => setShowRules(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MODO ESTUDO / TRABALHO</p><h2>Lista de foco</h2></div><button onClick={() => setShowRules(false)} aria-label="Fechar"><X size={20}/></button></div><p>Marque os sites que gostaria de limitar. Nesta primeira versão, a lista é apenas visual.</p>{['instagram.com', 'tiktok.com', 'youtube.com', 'x.com'].map(site => <label key={site} className="rule"><span>{site}</span><input type="checkbox" checked={blocked.includes(site)} onChange={() => setBlocked(old => old.includes(site) ? old.filter(x => x !== site) : [...old, site])}/></label>)}<button className="modal-done" onClick={() => setShowRules(false)}>Concluir</button></div></div>}
  </div>;
}
export default App;
