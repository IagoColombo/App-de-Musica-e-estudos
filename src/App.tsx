import { KaraokeDemo } from './CinematicKaraoke';
import { KaraokeText } from './Karaoke';
import { useEffect, useRef, useState } from 'react';
import { Maximize2, ArrowLeft, ArrowRight, ChevronDown, Clock3, Disc3, Heart, Home, Music2, Pause, Play, Repeat2, Search, Settings2, Shuffle, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { formatTime, type Song } from './data';
import { lyricsProxy, type ProxyEvent } from './lyricsService';
import { recognizeMusicLink, type MusicSource } from './sourceRecognition';
import { SpotifyPanel } from './SpotifyPanel';
import { SpotifyLibrary } from './SpotifyLibrary';
import { SpotifyControls } from './SpotifyControls';
import { SpotifyLyrics, clearSpotifyTranslationCache, type SpotifyLookup } from './SpotifyLyrics';
import { ProxyCard } from './ProxyCard';
import { FocusSession } from './FocusSession';
import type { SpotifySession, SpotifyTrack } from './spotify';
import { useAlbumPalette } from './useAlbumPalette';
import { WindowControls } from './WindowControls';
import { UpdateBanner } from './UpdateBanner';
import { useStuckHeader } from './useStuckHeader';
import { useButtonMotion, useAlbumTransition, useChannelRail, useFocusModeTimeline, useLyricsAnimation, usePageEntrance } from './useLyraMotion';
import { YouTubePlayer } from './YouTubePlayer';
import { YouTubeSearch } from './YouTubeSearchPanel';
import { getYouTubeChapters, type YouTubeChapter } from './youtubeSearch';

const nav = [{ label: 'Início', icon: Home }, { label: 'Buscar', icon: Search }, { label: 'Histórico', icon: Clock3 }, { label: 'Favoritos', icon: Heart }];

const emptySong: Song = { id: "", title: "", artist: "", album: "", duration: 0, accent: "#6db7b4", lines: [] };

function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyLookup, setSpotifyLookup] = useState<SpotifyLookup | null>(null);
  const [spotifyRefresh, setSpotifyRefresh] = useState(0);
  const song = songs[songIndex] ?? emptySong;
  const [recognizedSource, setRecognizedSource] = useState<MusicSource | null>(null);
  const youtubeSource = recognizedSource?.provider === 'YouTube' ? recognizedSource : null;
  const [youtubePlayback, setYoutubePlayback] = useState({ videoId: '', title: '', artist: '', positionMs: 0, durationMs: 0, playing: false });
  const [youtubeChapters, setYoutubeChapters] = useState<YouTubeChapter[]>([]);
  useEffect(() => {
    setYoutubeChapters([]);
    if (!youtubeSource) return;
    const controller = new AbortController();
    getYouTubeChapters(youtubeSource.id, controller.signal).then(setYoutubeChapters).catch(() => {});
    return () => controller.abort();
  }, [youtubeSource?.id]);
  const chapterIndex = youtubeChapters.reduce((index, chapter, i) => youtubePlayback.videoId === youtubeSource?.id && youtubePlayback.positionMs >= chapter.at ? i : index, -1);
  const chapter = chapterIndex >= 0 ? youtubeChapters[chapterIndex] : null;
  const chapterParts = chapter?.title.split(/\s+[-–—]\s+/, 2);
  const albumArtist = youtubePlayback.title.split(/\s+[-–—]\s+/, 2)[0];
  const videoParts = youtubePlayback.title.split(/\s+[-–—]\s+/, 2);
  const chapterArtist = chapterParts?.length === 2 ? chapterParts[0] : chapter ? albumArtist : videoParts.length === 2 ? videoParts[0] : youtubePlayback.artist.replace(/\s*[-–—]\s*Topic$/i, '');
  const chapterTitle = (chapterParts?.length === 2 ? chapterParts[1] : chapter?.title || (videoParts.length === 2 ? videoParts[1] : youtubePlayback.title)).replace(/^\d{1,2}[.)]\s*/, '');
  const chapterStart = chapter?.at || 0;
  const chapterEnd = youtubeChapters[chapterIndex + 1]?.at || youtubePlayback.durationMs;
  const albumPalette = useAlbumPalette(youtubeSource ? `https://i.ytimg.com/vi/${youtubeSource.id}/hqdefault.jpg` : spotifyTrack?.image, song.accent);
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
  const [linkError, setLinkError] = useState('');
  const [blocked, setBlocked] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:blocked') || '["instagram.com","tiktok.com"]'));
  const [showRules, setShowRules] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [lyrics, setLyrics] = useState(song.lines);
  const [activeNav, setActiveNav] = useState('Início');
  const [navigation, setNavigation] = useState({ pages: ['Início'], index: 0 });
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifySession, setSpotifySession] = useState<SpotifySession | null>(null);
  const [showSpotifyPanel, setShowSpotifyPanel] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:favorites') || '[]'));
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('lyra:history') || '[]'));
  const [focusSong, setFocusSong] = useState(() => localStorage.getItem('lyra:focusSong') || "");
  const [focusPlaylist, setFocusPlaylist] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem('lyra:focusPlaylist') || '[]'); const valid = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && songs.some(song => song.id === id)) : []; return valid; }
    catch { return []; }
  });
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { sentinelRef: topbarSentinel, stuck: topbarStuck } = useStuckHeader();
  const hasAudio = Boolean(audioUrls[song.id]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const duration = hasAudio && audioDuration ? audioDuration : song.duration;
  const root = useRef<HTMLDivElement>(null);
  const channelRail = useRef<HTMLDivElement>(null);
  useChannelRail(channelRail, activeNav);
  useButtonMotion(root);
  const [karaoke, setKaraoke] = useState(() => localStorage.getItem("lyra:karaoke") === "true");
  const [large, setLarge] = useState(false);
  useEffect(() => { localStorage.setItem("lyra:karaoke", String(karaoke)); }, [karaoke]);
  const miniSource = youtubeSource && youtubePlayback.playing ? 'youtube' : spotifyTrack?.isPlaying ? 'spotify' : playing && hasAudio ? 'local'
    : youtubeSource ? 'youtube' : spotifyTrack ? 'spotify' : hasAudio ? 'local' : null;
  const dockedSource = activeNav === 'Início' ? null : miniSource;
  const audioDock = dockedSource === 'spotify' || dockedSource === 'local' ? dockedSource : undefined;
  const lyricList = useRef<HTMLDivElement>(null);
  const current = lyrics.reduce((index, line, i) => position >= line.at ? i : index, -1);
  useLyricsAnimation(lyricList, current, song.id, large, activeNav + Boolean(youtubeSource || spotifyTrack));
  useFocusModeTimeline(root, focus);
  useAlbumTransition(root, albumPalette.accent, albumPalette.deep, spotifyTrack?.id ?? song.id);
  usePageEntrance(root, activeNav, song.id);

  useEffect(() => {
    setLyrics(lyricsProxy.getLyrics(song.id) ?? []);
    setEvents(lyricsProxy.history());
  }, [song.id, song.accent]);

  useEffect(() => { localStorage.setItem('lyra:favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('lyra:history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('lyra:focusSong', focusSong); }, [focusSong]);
  useEffect(() => { localStorage.setItem('lyra:focusPlaylist', JSON.stringify(focusPlaylist)); }, [focusPlaylist]);
  useEffect(() => { if (!focusPlaylist.includes(focusSong)) setFocusSong(focusPlaylist[0] ?? ""); }, [focusPlaylist, focusSong]);
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

  function changeSong(next: number, autoPlay = false) {
    if (!songs.length) return;
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
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    setSongs(items => [...items, { ...emptySong, id, title: file.name.replace(/\.[^.]+$/, ''), artist: 'Arquivo local' }]);
    setAudioUrls(old => ({ ...old, [id]: url }));
    setSongIndex(songs.length);
    setHistory(old => [id, ...old].slice(0, 20));
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
    if (source?.provider === 'YouTube') { setPlaying(false); navigatePage('Início'); }
  }
  const shownSongs = songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));
  const queryLooksLikeLink = /(?:https?:\/\/|spotify\.com|youtu(?:be)?\.)/i.test(query);

  return <div className={`app ${spotifyTrack ? 'spotify-active' : ''}`} ref={root}>
    <UpdateBanner onAvailable={setUpdateVersion}/>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i/><i/><i/><i/><i/></span><b>LyraFlow</b></div>
      <div className="channel-rail" ref={channelRail}>
      <span className="channel-marker" aria-hidden="true"/>
      <div className="side-group">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'selected' : ''}`} aria-current={activeNav === label ? 'page' : undefined} onClick={() => navigatePage(label)}><Icon size={19}/>{label}</button>)}</div>
      <div className="side-rule"/><div className="side-caption">FONTES DE MÚSICA</div>
      <button className={`nav-item source-nav ${activeNav === 'Spotify' ? 'selected' : ''}`} aria-current={activeNav === 'Spotify' ? 'page' : undefined} onClick={() => navigatePage('Spotify')}><span className="input-led" data-live={spotifyConnected}/><Disc3 size={20}/><span>Spotify<small>{spotifyConnected ? 'Conectado' : 'Desconectado'}</small></span></button>
      <button className="nav-item source-nav" onClick={() => { navigatePage('Buscar'); document.querySelector<HTMLInputElement>('.search input')?.focus(); }}><span className="input-led"/><Play size={20}/><span>YouTube<small>Colar link</small></span></button>
      <button className={`nav-item source-nav ${activeNav === 'Biblioteca' ? 'selected' : ''}`} aria-current={activeNav === 'Biblioteca' ? 'page' : undefined} onClick={() => navigatePage('Biblioteca')}><span className="input-led"/><Music2 size={20}/><span>Arquivo local<small>Biblioteca</small></span></button>
      </div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowRules(true)}><Settings2 size={19}/> Configurações</button></div>
    </aside>
    <div className="main-area" style={{ '--album-accent': albumPalette.accent, '--album-glow': albumPalette.glow, '--album-deep': albumPalette.deep, '--current-album-art': youtubeSource ? `url(https://i.ytimg.com/vi/${youtubeSource.id}/hqdefault.jpg)` : spotifyTrack?.image ? `url(${JSON.stringify(spotifyTrack.image)})` : 'none' } as React.CSSProperties}>
      <div className="topbar-sentinel" ref={topbarSentinel} aria-hidden="true"/>
      <header className="topbar" data-stuck={topbarStuck} data-tauri-drag-region><div className="history-buttons"><button aria-label="Voltar" disabled={navigation.index === 0} onClick={() => moveNavigation(-1)}><ArrowLeft size={18}/></button><button aria-label="Avançar" disabled={navigation.index >= navigation.pages.length - 1} onClick={() => moveNavigation(1)}><ArrowRight size={18}/></button></div>
        <div className="search-wrap"><div className="search"><Search size={20} aria-hidden="true"/><input ref={searchInput} aria-label="Buscar música, artista ou link" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key !== 'Enter') return; if (queryLooksLikeLink) { detectMusicLink(query); setQuery(''); } else if (shownSongs[0]) { changeSong(songs.indexOf(shownSongs[0])); navigatePage('Início'); } }} placeholder="Buscar música, artista ou colar um link..."/>{query && <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => { setQuery(''); setLinkError(''); searchInput.current?.focus(); }}><X size={16} aria-hidden="true"/></button>}</div>{query && <div className="search-results">{queryLooksLikeLink ? <button onClick={() => { detectMusicLink(query); setQuery(''); }}><Search size={16}/> Identificar link do Spotify ou YouTube</button> : <>{shownSongs.map((s) => <button key={s.id} onClick={() => { changeSong(songs.indexOf(s)); navigatePage('Início'); }}><Music2 size={16}/><span>{s.title}<small>{s.artist}</small></span></button>)}<YouTubeSearch key={query.trim()} query={query} onSelect={item => { detectMusicLink(`https://www.youtube.com/watch?v=${item.id}`); setQuery(''); }}/></>}</div>}{(recognizedSource?.provider === 'Spotify' || linkError) && <div className="search-link-result">{recognizedSource?.provider === 'Spotify' ? <><div><strong>Spotify identificado</strong><button onClick={() => setRecognizedSource(null)} aria-label="Fechar link"><X size={15}/></button></div><iframe title="Player Spotify" src={recognizedSource.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy"/><a href={recognizedSource.url} target="_blank" rel="noopener noreferrer">Abrir no Spotify ↗</a></> : <p role="alert">{linkError}</p>}</div>}</div>
        <WindowControls updateVersion={updateVersion}/></header>
      <div className="content">
        {activeNav !== 'Início' && activeNav !== 'Spotify' && <div className="collection"><div><p className="eyebrow">{activeNav === 'Buscar' ? 'ENCONTRE SUA MÚSICA' : 'SUA BIBLIOTECA'}</p><h2>{activeNav}</h2><p className="collection-intro">{activeNav === 'Buscar' ? 'Busque uma música pelo nome ou artista na barra acima. Você também pode colar um link.' : activeNav === 'Favoritos' ? 'As músicas que você marcou para ouvir de novo.' : activeNav === 'Histórico' ? 'As últimas faixas que você abriu.' : 'Faixas disponíveis para associar um arquivo de áudio local.'}</p></div><div className="collection-list">{(activeNav === 'Buscar' ? shownSongs : activeNav === 'Favoritos' ? songs.filter(s => favorites.includes(s.id)) : activeNav === 'Histórico' ? history.map(id => songs.find(s => s.id === id)).filter((s): s is typeof songs[number] => Boolean(s)) : songs).map(s => <button key={s.id} onClick={() => { changeSong(songs.indexOf(s)); navigatePage('Início'); }}><Music2 size={17}/><span>{s.title}<small>{s.artist}</small></span><ArrowRight size={15}/></button>)}{activeNav === 'Favoritos' && favorites.length === 0 && <p>Nenhuma faixa favorita ainda.</p>}{activeNav === 'Histórico' && history.length === 0 && <p>O histórico aparece após você escolher uma faixa.</p>}</div></div>}
        <section className="spotify-account" hidden={activeNav !== 'Spotify' || (!showSpotifyPanel && spotifyConnected)} aria-label="Conta Spotify">
          <SpotifyPanel onConnectionChange={setSpotifyConnected} onSessionChange={setSpotifySession} onOpenLibrary={() => { setShowSpotifyPanel(false); navigatePage('Spotify'); }}/>
        </section>
        {activeNav === 'Spotify' && <SpotifyLibrary session={spotifySession} onSessionChange={setSpotifySession} activeTrackId={spotifyTrack?.id} onOpenConnection={() => { setShowSpotifyPanel(true); requestAnimationFrame(() => document.querySelector('.spotify-account')?.scrollIntoView({ block: 'nearest' })); }} onBack={() => navigatePage('Início')}/>}
        <div className="home-view" data-inactive={activeNav !== 'Início' || undefined}>
        <section className="page-heading intro"><div><p className="eyebrow accent-text">MÚSICA EM FOCO</p><h1>Deixe a música falar.</h1></div><span className="source-pill"><span className="live-dot"/> {youtubeSource ? 'YouTube' : spotifyTrack ? 'Spotify' : 'Biblioteca local'} <ChevronDown size={14}/></span></section>
        <div className="workspace">
          {youtubeSource && <YouTubePlayer key={youtubeSource.id} source={youtubeSource} minimized={activeNav !== 'Início'} hidden={Boolean(audioDock)} onExpand={() => navigatePage('Início')} onClose={() => setRecognizedSource(null)} onPlayback={setYoutubePlayback}/>}
          <section className="player-column intro" data-audio-dock={audioDock}
            aria-label={audioDock === 'spotify' ? 'Miniplayer do Spotify' : audioDock === 'local' ? 'Miniplayer de áudio local' : undefined}>
            {audioDock && <div className="audio-dock-heading">
              <span>{audioDock === 'spotify' ? 'Spotify' : 'Áudio local'}</span>
              <button type="button" onClick={() => navigatePage('Início')} aria-label="Expandir miniplayer" title="Expandir player"><Maximize2 size={15}/></button>
            </div>}
            {spotifyTrack && <div className="spotify-main-player">{spotifyTrack.image && <img src={spotifyTrack.image} alt={`Capa de ${spotifyTrack.album}`}/>}<p className="eyebrow">SPOTIFY · {spotifyTrack.isPlaying ? 'TOCANDO AGORA' : 'PAUSADA'}</p><h2 key={spotifyTrack.id}>{spotifyTrack.title}</h2><p>{spotifyTrack.artist} · {spotifyTrack.album}</p><SpotifyControls session={spotifySession} track={spotifyTrack} onSessionChange={setSpotifySession}/><a className="spotify-open-bar" href={spotifyTrack.url} target="_blank" rel="noopener noreferrer"><Disc3 size={19}/> Reproduzindo no Spotify <span aria-hidden="true">↗</span></a></div>}<div className="local-player">{hasAudio && <><div className={`artwork art-${song.id}`}><div className="art-halo"/><div className="art-sun"/><div className="art-hill one"/><div className="art-hill two"/><div className="art-grain"/><div className="art-label"><span>LYRAFLOW SESSIONS</span><strong>{song.album}</strong></div></div>

            <div className="song-title"><div><p className="eyebrow">TOCANDO AGORA</p><h2 key={song.id}>{song.title}</h2><p>{song.artist} <span>·</span> {song.album}</p></div><button className={`icon-button ${favorites.includes(song.id) ? 'favorited' : ''}`} aria-pressed={favorites.includes(song.id)} aria-label="Favorito" onClick={toggleFavorite}><Heart size={22} fill={favorites.includes(song.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="player-progress"><input aria-label="Posição da música" type="range" min="0" max={duration} value={position} disabled={!hasAudio} onChange={e => seek(Number(e.target.value))} style={{'--range': `${position / duration * 100}%`} as React.CSSProperties}/><div><span>{formatTime(position)}</span><span>{formatTime(duration)}</span></div></div>
            <div className="controls"><button aria-label="Reprodução aleatória" aria-pressed={shuffle} className={shuffle ? 'control-active' : ''} onClick={() => setShuffle(value => !value)}><Shuffle size={19}/></button><button aria-label="Faixa anterior" onClick={() => skipSong(-1)}><SkipBack size={21} fill="currentColor"/></button><button className="play-button" aria-label={playing ? 'Pausar' : 'Reproduzir áudio local'} disabled={!hasAudio} title={!hasAudio ? 'Associe um arquivo de áudio para reproduzir' : undefined} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}</button><button aria-label="Próxima faixa" onClick={() => skipSong(1)}><SkipForward size={21} fill="currentColor"/></button><button aria-label="Repetir faixa" aria-pressed={repeat} className={repeat ? 'control-active' : ''} onClick={() => setRepeat(value => !value)}><Repeat2 size={19}/></button></div>
            <div className="volume"><Volume2 size={17}/><input aria-label="Volume do áudio local" type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} style={{'--range': `${volume}%`} as React.CSSProperties}/><span>{volume}%</span></div>
            </>}<div className="local-note"><Music2 size={16}/><span>{hasAudio ? 'Áudio local associado a esta faixa' : 'Adicione um arquivo de áudio para começar'}</span></div>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => importAudio(e.target.files?.[0])}/><button className="audio-import" onClick={() => fileRef.current?.click()}>Adicionar áudio local</button>
            <audio ref={audioRef} src={audioUrls[song.id]} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e => setAudioDuration(e.currentTarget.duration)} onEnded={e => handleAudioEnded(e.currentTarget)}/>
            </div>
          </section>
          <section data-visual-mode="cinematic" className={`lyrics-column intro ${large ? "large-type" : ""}`}><div className="panel-heading"><h2>Letra e tradução</h2><div className="lyrics-actions"><button className="karaoke-toggle" aria-pressed={karaoke} onClick={() => setKaraoke(!karaoke)}>Karaokê</button><button aria-pressed={large} className="font-button" aria-label="Alterar tamanho da letra" title="Tamanho da letra" onClick={() => setLarge(!large)}>Aa</button></div></div>
            <KaraokeDemo/>{youtubeSource && youtubePlayback.videoId === youtubeSource.id && youtubePlayback.title && youtubePlayback.durationMs > 0 ? <SpotifyLyrics large={large} karaoke={karaoke} track={{ id: `${youtubeSource.id}:${chapterIndex}`, title: chapterTitle, artist: chapterArtist, album: '', image: `https://i.ytimg.com/vi/${youtubeSource.id}/hqdefault.jpg`, url: youtubeSource.url, progressMs: Math.max(0, youtubePlayback.positionMs - chapterStart), durationMs: chapterEnd - chapterStart, isPlaying: youtubePlayback.playing }} refreshKey={spotifyRefresh} onLookup={setSpotifyLookup}/> : youtubeSource ? <p className="lyrics-message">Aguardando título e duração do vídeo para buscar a letra…</p> : spotifyTrack ? <SpotifyLyrics large={large} karaoke={karaoke} track={spotifyTrack} refreshKey={spotifyRefresh} onLookup={setSpotifyLookup}/> : <>{!lyrics.length && <p className="lyrics-message">Sem letra disponível para o áudio local.</p>}<div className="lyric-list" ref={lyricList}>{lyrics.map((line, i) => <button aria-current={i === current ? "true" : undefined} key={line.at} className={`lyric ${i === current ? 'active' : ''}`} onClick={() => seek(line.at)} disabled={!hasAudio} title={!hasAudio ? 'Associe um áudio para buscar nesta letra' : undefined}><span className="lyric-time">{formatTime(line.at)}</span>{karaoke && hasAudio && i === current ? <KaraokeText line={line} position={position} end={lyrics[i+1]?.at ?? duration}/> : <strong>{line.original}</strong>}<em>{line.translation}</em></button>)}</div></>}
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
