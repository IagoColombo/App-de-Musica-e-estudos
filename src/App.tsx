import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Disc3, Heart, Home, Music2, Pause, Play, Repeat2, Search, Settings2, Shuffle, SkipBack, SkipForward, Target, Volume2, X } from 'lucide-react';
import { formatTime, songs } from './data';
import { lyricsProxy, type ProxyEvent } from './lyricsService';
import { recognizeMusicLink, type MusicSource } from './sourceRecognition';
import { SpotifyPanel } from './SpotifyPanel';
import { SpotifyLyrics, clearSpotifyTranslationCache, type SpotifyLookup } from './SpotifyLyrics';
import { ProxyCard } from './ProxyCard';
import { FocusSession } from './FocusSession';
import type { SpotifyTrack } from './spotify';
import { useAlbumPalette } from './useAlbumPalette';
import { WindowControls } from './WindowControls';

gsap.registerPlugin(ScrollTrigger, useGSAP);
const nav = [{ label: 'Início', icon: Home }, { label: 'Buscar', icon: Search }, { label: 'Histórico', icon: Clock3 }, { label: 'Favoritos', icon: Heart }];

function App() {
  const [songIndex, setSongIndex] = useState(0);
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyLookup, setSpotifyLookup] = useState<SpotifyLookup | null>(null);
  const [spotifyRefresh, setSpotifyRefresh] = useState(0);
  const song = songs[songIndex];
  const albumPalette = useAlbumPalette(spotifyTrack?.image, song.accent);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [volume, setVolume] = useState(72);
  const [focus, setFocus] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusDeadline = useRef<number | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(() => Math.min(240, Math.max(1, Number(localStorage.getItem('lyra:focusMinutes')) || 45)) * 60);
  const [focusMinutes, setFocusMinutes] = useState(() => Math.min(240, Math.max(1, Number(localStorage.getItem('lyra:focusMinutes')) || 45)));
  const [recognizedSource, setRecognizedSource] = useState<MusicSource | null>(null);
  const [linkError, setLinkError] = useState('');
  const [blocked, setBlocked] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:blocked') || '["instagram.com","tiktok.com"]'));
  const [showRules, setShowRules] = useState(false);
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [lyrics, setLyrics] = useState(song.lines);
  const [activeNav, setActiveNav] = useState('Início');
  const [navigation, setNavigation] = useState({ pages: ['Início'], index: 0 });
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showSpotifyPanel, setShowSpotifyPanel] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:favorites') || '[]'));
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:history') || '[]'));
  const [focusSong, setFocusSong] = useState(() => localStorage.getItem('lyra:focusSong') || songs[0].id);
  const [focusPlaylist, setFocusPlaylist] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem('lyra:focusPlaylist') || '[]'); const valid = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && songs.some(song => song.id === id)) : []; return valid.length ? valid : [songs[0].id]; }
    catch { return [songs[0].id]; }
  });
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
  }, [song.id, song.accent]);

  useEffect(() => { localStorage.setItem('lyra:favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('lyra:history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('lyra:focusSong', focusSong); }, [focusSong]);
  useEffect(() => { localStorage.setItem('lyra:focusPlaylist', JSON.stringify(focusPlaylist)); }, [focusPlaylist]);
  useEffect(() => { if (!focusPlaylist.includes(focusSong)) setFocusSong(focusPlaylist[0]); }, [focusPlaylist, focusSong]);
  useEffect(() => { localStorage.setItem('lyra:blocked', JSON.stringify(blocked)); }, [blocked]);
  useEffect(() => { localStorage.setItem('lyra:focusMinutes', String(focusMinutes)); }, [focusMinutes]);
  useEffect(() => {
    const onTrack = (event: Event) => setSpotifyTrack((event as CustomEvent<SpotifyTrack | null>).detail);
    window.addEventListener('lyra:spotify-track', onTrack);
    return () => window.removeEventListener('lyra:spotify-track', onTrack);
  }, []);
  useEffect(() => { setSpotifyLookup(null); }, [spotifyTrack?.id]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    audio.volume = volume / 100;
    if (playing) audio.play().catch(() => setPlaying(false)); else audio.pause();
  }, [playing, hasAudio, song.id, volume]);
  useEffect(() => {
    if (!focusRunning || !focus) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((focusDeadline.current ?? Date.now()) - Date.now()) / 1000));
      setFocusSeconds(remaining);
      if (remaining === 0) { focusDeadline.current = null; setFocusRunning(false); }
    }, 250);
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

  function changeSong(next: number, autoPlay = false) {
    setSongIndex((next + songs.length) % songs.length);
    setPosition(0);
    setPlaying(autoPlay && Boolean(audioUrls[songs[(next + songs.length) % songs.length].id]));
    setQuery('');
    setAudioDuration(null);
    const id = songs[(next + songs.length) % songs.length].id;
    setHistory(old => [id, ...old.filter(item => item !== id)].slice(0, 20));
  }
  function skipSong(direction: -1 | 1) {
    if (focus && focusPlaylist.length > 1) {
      const currentIndex = focusPlaylist.indexOf(song.id);
      const nextId = focusPlaylist[(currentIndex + direction + focusPlaylist.length) % focusPlaylist.length];
      const nextIndex = songs.findIndex(item => item.id === nextId);
      if (nextIndex >= 0) { changeSong(nextIndex); return; }
    }
    if (shuffle && direction === 1 && songs.length > 1) {
      const offset = 1 + Math.floor(Math.random() * (songs.length - 1));
      changeSong(songIndex + offset);
      return;
    }
    changeSong(songIndex + direction);
  }
  function handleAudioEnded(audio: HTMLAudioElement) {
    if (repeat) { audio.currentTime = 0; void audio.play().catch(() => setPlaying(false)); return; }
    if (focus && focusPlaylist.length > 1) {
      const index = focusPlaylist.indexOf(song.id);
      const nextId = focusPlaylist[(index + 1) % focusPlaylist.length];
      const nextIndex = songs.findIndex(item => item.id === nextId);
      if (nextIndex >= 0 && audioUrls[nextId]) { changeSong(nextIndex, true); return; }
    }
    setPlaying(false);
  }
  function navigatePage(page: string) {
    setActiveNav(page);
    setNavigation(current => {
      if (current.pages[current.index] === page) return current;
      const pages = [...current.pages.slice(0, current.index + 1), page];
      return { pages, index: pages.length - 1 };
    });
    if (page === 'Buscar') document.querySelector<HTMLInputElement>('.search input')?.focus();
  }
  function moveNavigation(delta: number) {
    const index = navigation.index + delta;
    if (index < 0 || index >= navigation.pages.length) return;
    setNavigation(current => ({ ...current, index }));
    setActiveNav(navigation.pages[index]);
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
    if (!hasAudio) return;
    setPosition(value);
    if (hasAudio && audioRef.current) audioRef.current.currentTime = value;
  }
  function toggleFavorite() { setFavorites(old => old.includes(song.id) ? old.filter(id => id !== song.id) : [...old, song.id]); }
  function toggleFocusSong(id: string) {
    setFocusPlaylist(old => {
      if (old.includes(id)) return old.length > 1 ? old.filter(item => item !== id) : old;
      return [...old, id];
    });
  }
  function consultAgain() { if (spotifyTrack) { setSpotifyLookup(null); setSpotifyRefresh(value => value + 1); } else { setLyrics(lyricsProxy.getLyrics(song.id) ?? []); setEvents(lyricsProxy.history()); } }
  function clearCache() { lyricsProxy.clear(); clearSpotifyTranslationCache(); setEvents([]); if (spotifyTrack) { setSpotifyLookup(null); setSpotifyRefresh(value => value + 1); } }
  function toggleFocus() { setFocus(value => { if (value) { focusDeadline.current = null; setFocusRunning(false); } return !value; }); }
  function toggleFocusRunning() {
    if (focusRunning) {
      setFocusSeconds(Math.max(0, Math.ceil(((focusDeadline.current ?? Date.now()) - Date.now()) / 1000)));
      focusDeadline.current = null;
      setFocusRunning(false);
      return;
    }
    const seconds = focusSeconds || focusMinutes * 60;
    setFocusSeconds(seconds);
    focusDeadline.current = Date.now() + seconds * 1000;
    setFocusRunning(true);
  }
  function stopFocus() { focusDeadline.current = null; setFocusRunning(false); setFocusSeconds(focusMinutes * 60); }
  function updateFocusMinutes(value: number) {
    const minutes = Math.min(240, Math.max(1, Math.round(value || 1)));
    setFocusMinutes(minutes);
    focusDeadline.current = null;
    setFocusRunning(false);
    setFocusSeconds(minutes * 60);
  }
  function detectMusicLink(value: string) {
    const source = recognizeMusicLink(value);
    setRecognizedSource(source);
    setLinkError(source ? '' : 'Cole o link de uma faixa do Spotify ou de um vídeo do YouTube.');
  }
  const shownSongs = songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));
  const queryLooksLikeLink = /(?:https?:\/\/|spotify\.com|youtu(?:be)?\.)/i.test(query);

  return <div className={`app ${spotifyTrack ? 'spotify-active' : ''}`} ref={root}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i/><i/><i/><i/><i/></span><b>LyraFlow</b></div>
      <div className="side-group">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'selected' : ''}`} onClick={() => navigatePage(label)}><Icon size={19}/>{label}</button>)}</div>
      <div className="side-rule"/><div className="side-caption">FONTES DE MÚSICA</div>
      <button className={`nav-item source-nav ${showSpotifyPanel ? 'selected' : ''}`} onClick={() => setShowSpotifyPanel(value => !value)} aria-expanded={showSpotifyPanel}><Disc3 size={20} className="spotify-source-icon"/><span>Spotify<small className={spotifyConnected ? 'source-connected' : ''}>{spotifyConnected ? 'Conectado' : 'Conectar'}</small></span></button>
      <div className={`sidebar-spotify ${showSpotifyPanel ? 'open' : ''}`}><SpotifyPanel onConnectionChange={setSpotifyConnected}/></div>
      <button className="nav-item source-nav" onClick={() => { navigatePage('Buscar'); document.querySelector<HTMLInputElement>('.search input')?.focus(); }}><Play size={20} className="youtube-source-icon"/><span>YouTube<small>Colar link</small></span></button>
      <button className={`nav-item source-nav ${activeNav === 'Biblioteca' ? 'selected' : ''}`} onClick={() => navigatePage('Biblioteca')}><Music2 size={20}/><span>Arquivo local<small>Biblioteca</small></span></button>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowRules(true)}><Settings2 size={19}/> Configurações</button></div>
    </aside>
    <div className="main-area" style={{ '--album-accent': albumPalette.accent, '--album-glow': albumPalette.glow, '--album-deep': albumPalette.deep, '--current-album-art': spotifyTrack?.image ? `url(${JSON.stringify(spotifyTrack.image)})` : 'none' } as React.CSSProperties}>
      <header className="topbar" data-tauri-drag-region><div className="history-buttons"><button aria-label="Voltar" disabled={navigation.index === 0} onClick={() => moveNavigation(-1)}><ArrowLeft size={18}/></button><button aria-label="Avançar" disabled={navigation.index >= navigation.pages.length - 1} onClick={() => moveNavigation(1)}><ArrowRight size={18}/></button></div>
        <div className="search-wrap"><label className="search"><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key !== 'Enter') return; if (queryLooksLikeLink) { detectMusicLink(query); setQuery(''); } else if (shownSongs[0]) { changeSong(songs.indexOf(shownSongs[0])); navigatePage('Início'); } }} placeholder="Buscar música, artista ou colar um link..."/></label>{query && <div className="search-results">{queryLooksLikeLink ? <button onClick={() => { detectMusicLink(query); setQuery(''); }}><Search size={16}/> Identificar link do Spotify ou YouTube</button> : shownSongs.length ? shownSongs.map((s) => <button key={s.id} onClick={() => { changeSong(songs.indexOf(s)); navigatePage('Início'); }}><Music2 size={16}/><span>{s.title}<small>{s.artist}</small></span></button>) : <p>Nenhuma faixa local encontrada.</p>}</div>}{(recognizedSource || linkError) && <div className="search-link-result">{recognizedSource ? <><div><strong>{recognizedSource.provider} identificado</strong><button onClick={() => setRecognizedSource(null)} aria-label="Fechar link"><X size={15}/></button></div><iframe title={`Player ${recognizedSource.provider}`} src={recognizedSource.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy"/><a href={recognizedSource.url} target="_blank" rel="noopener noreferrer">Abrir no {recognizedSource.provider} ↗</a></> : <p role="alert">{linkError}</p>}</div>}</div>
        <WindowControls/></header>
      <div className="content">
        {activeNav !== 'Início' && <div className="collection"><div><p className="eyebrow">{activeNav === 'Buscar' ? 'ENCONTRE SUA MÚSICA' : 'SUA BIBLIOTECA'}</p><h2>{activeNav}</h2><p className="collection-intro">{activeNav === 'Buscar' ? 'Busque uma faixa local pelo nome ou artista na barra acima. Você também pode colar um link.' : activeNav === 'Favoritos' ? 'As músicas que você marcou para ouvir de novo.' : activeNav === 'Histórico' ? 'As últimas faixas que você abriu.' : 'Faixas disponíveis para associar um arquivo de áudio local.'}</p></div><div className="collection-list">{(activeNav === 'Buscar' ? shownSongs : activeNav === 'Favoritos' ? songs.filter(s => favorites.includes(s.id)) : activeNav === 'Histórico' ? history.map(id => songs.find(s => s.id === id)).filter((s): s is typeof songs[number] => Boolean(s)) : songs).map(s => <button key={s.id} onClick={() => { changeSong(songs.indexOf(s)); navigatePage('Início'); }}><Music2 size={17}/><span>{s.title}<small>{s.artist}</small></span><ArrowRight size={15}/></button>)}{activeNav === 'Favoritos' && favorites.length === 0 && <p>Nenhuma faixa favorita ainda.</p>}{activeNav === 'Histórico' && history.length === 0 && <p>O histórico aparece após você escolher uma faixa.</p>}{activeNav === 'Buscar' && shownSongs.length === 0 && <p>Nenhuma faixa local encontrada.</p>}</div></div>}
        <div className="home-view" hidden={activeNav !== 'Início'}>
        <section className="page-heading intro"><div><p className="eyebrow accent-text">MÚSICA EM FOCO</p><h1>Deixe a música falar.</h1></div><span className="source-pill"><span className="live-dot"/> {spotifyTrack ? 'Spotify' : 'Biblioteca local'} <ChevronDown size={14}/></span></section>
        <div className="workspace">
          <section className="player-column intro">{spotifyTrack && <div className="spotify-main-player">{spotifyTrack.image && <img src={spotifyTrack.image} alt={`Capa de ${spotifyTrack.album}`}/>}<p className="eyebrow">SPOTIFY · {spotifyTrack.isPlaying ? 'TOCANDO AGORA' : 'PAUSADA'}</p><h2>{spotifyTrack.title}</h2><p>{spotifyTrack.artist} · {spotifyTrack.album}</p><div className="spotify-progress"><span>{formatTime(spotifyTrack.progressMs / 1000)}</span><div className="spotify-progress-track"><span style={{ width: `${spotifyTrack.durationMs ? spotifyTrack.progressMs / spotifyTrack.durationMs * 100 : 0}%` }}/></div><span>{formatTime(spotifyTrack.durationMs / 1000)}</span></div><a className="spotify-open-bar" href={spotifyTrack.url} target="_blank" rel="noopener noreferrer"><Disc3 size={19}/> Reproduzindo no Spotify <span aria-hidden="true">↗</span></a></div>}<div className={`artwork art-${song.id}`}><div className="art-halo"/><div className="art-sun"/><div className="art-hill one"/><div className="art-hill two"/><div className="art-grain"/><div className="art-label"><span>LYRAFLOW SESSIONS</span><strong>{song.album}</strong></div></div>
            <div className="song-title"><div><p className="eyebrow">TOCANDO AGORA</p><h2>{song.title}</h2><p>{song.artist} <span>·</span> {song.album}</p></div><button className={`icon-button ${favorites.includes(song.id) ? 'favorited' : ''}`} aria-label="Favorito" onClick={toggleFavorite}><Heart size={22} fill={favorites.includes(song.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="player-progress"><input aria-label="Posição da música" type="range" min="0" max={duration} value={position} disabled={!hasAudio} onChange={e => seek(Number(e.target.value))} style={{'--range': `${position / duration * 100}%`} as React.CSSProperties}/><div><span>{formatTime(position)}</span><span>{formatTime(duration)}</span></div></div>
            <div className="controls"><button aria-label="Reprodução aleatória" aria-pressed={shuffle} className={shuffle ? 'control-active' : ''} onClick={() => setShuffle(value => !value)}><Shuffle size={19}/></button><button aria-label="Faixa anterior" onClick={() => skipSong(-1)}><SkipBack size={21} fill="currentColor"/></button><button className="play-button" aria-label={playing ? 'Pausar' : 'Reproduzir áudio local'} disabled={!hasAudio} title={!hasAudio ? 'Associe um arquivo de áudio para reproduzir' : undefined} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}</button><button aria-label="Próxima faixa" onClick={() => skipSong(1)}><SkipForward size={21} fill="currentColor"/></button><button aria-label="Repetir faixa" aria-pressed={repeat} className={repeat ? 'control-active' : ''} onClick={() => setRepeat(value => !value)}><Repeat2 size={19}/></button></div>
            <div className="volume"><Volume2 size={17}/><input aria-label="Volume do áudio local" type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} style={{'--range': `${volume}%`} as React.CSSProperties}/><span>{volume}%</span></div>
            <div className="local-note"><Music2 size={16}/><span>{hasAudio ? 'Áudio local associado a esta faixa' : 'Associe um áudio local para reproduzir'}</span></div>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => importAudio(e.target.files?.[0])}/><button className="audio-import" onClick={() => fileRef.current?.click()}>Associar áudio local a esta faixa</button>
            <audio ref={audioRef} src={audioUrls[song.id]} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e => setAudioDuration(e.currentTarget.duration)} onEnded={e => handleAudioEnded(e.currentTarget)}/>
          </section>
          <section className="lyrics-column intro"><div className="panel-heading"><h2>Letra e tradução</h2><button className="font-button" aria-label="Alterar tamanho da letra" title="Tamanho da letra" onClick={() => document.querySelector('.lyrics-column')?.classList.toggle('large-type')}>Aa</button></div>
            {spotifyTrack ? <SpotifyLyrics track={spotifyTrack} refreshKey={spotifyRefresh} onLookup={setSpotifyLookup}/> : <><div className="lyric-list" ref={lyricList}>{lyrics.map((line, i) => <button key={line.at} className={`lyric ${i === current ? 'active' : ''}`} onClick={() => seek(line.at)} disabled={!hasAudio} title={!hasAudio ? 'Associe um áudio para buscar nesta letra' : undefined}><span className="lyric-time">{formatTime(line.at)}</span><strong>{line.original}</strong><em>{line.translation}</em></button>)}</div></>}
            <button className="focus-shortcut" onClick={toggleFocus} role="switch" aria-checked={focus}><span><Target size={18}/> Modo Estudo / Trabalho</span><span title="O bloqueio depende da opção escolhida na sessão de foco">ⓘ</span><span className={`switch ${focus ? 'on' : ''}`}><span/></span></button>
          </section>
          <aside className="right-column intro"><ProxyCard title={spotifyTrack?.title ?? song.title} events={events} spotifyLookup={spotifyTrack ? spotifyLookup : undefined} onRefresh={consultAgain} onClear={clearCache}/><FocusSession enabled={focus} running={focusRunning} seconds={focusSeconds} minutes={focusMinutes} songTitle={songs.find(s => s.id === focusSong)?.title ?? song.title} playlistCount={focusPlaylist.length} blocked={blocked} onToggle={toggleFocus} onToggleRunning={toggleFocusRunning} onStop={stopFocus} onMinutes={updateFocusMinutes} onSettings={() => setShowRules(true)}/></aside>
        </div>
        </div>
      </div>
    </div>
    {showRules && <div className="modal-backdrop" onClick={() => setShowRules(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MODO ESTUDO / TRABALHO</p><h2>Configurar sessão</h2></div><button onClick={() => setShowRules(false)} aria-label="Fechar"><X size={20}/></button></div><h3>Minha playlist de foco</h3><p>Escolha as faixas locais. Ao terminar uma música, a próxima com áudio associado começa automaticamente.</p>{songs.map(item => <label key={item.id} className="rule"><span>{item.title}</span><input type="checkbox" checked={focusPlaylist.includes(item.id)} onChange={() => toggleFocusSong(item.id)}/></label>)}<label className="focus-current">Faixa atual <select value={focusSong} onChange={e => { const id = e.target.value; setFocusSong(id); changeSong(songs.findIndex(item => item.id === id)); }}>{songs.filter(item => focusPlaylist.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><h3>Sites limitados</h3><p>Marque os sites para bloquear durante a sessão. O modo Windows solicita permissão de administrador.</p>{['instagram.com', 'tiktok.com', 'youtube.com', 'x.com'].map(site => <label key={site} className="rule"><span>{site}</span><input type="checkbox" checked={blocked.includes(site)} onChange={() => setBlocked(old => old.includes(site) ? old.filter(x => x !== site) : [...old, site])}/></label>)}<button className="modal-done" onClick={() => setShowRules(false)}>Concluir</button></div></div>}
  </div>;
}
export default App;
