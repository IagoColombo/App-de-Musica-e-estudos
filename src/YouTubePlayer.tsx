import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, X } from 'lucide-react';
import type { MusicSource } from './sourceRecognition';

type Player = {
  destroy(): void; playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void; getCurrentTime(): number; getDuration(): number; getVideoData(): { title?: string; author?: string };
};
type YouTubeAPI = { Player: new (element: HTMLElement, options: object) => Player };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT!); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { apiPromise = undefined; reject(new Error('Não foi possível carregar o player do YouTube.')); };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function YouTubePlayer({ source, active, onClose, onPlayback }: { source: MusicSource; active: boolean; onClose: () => void; onPlayback: (state: { title: string; artist: string; positionMs: number; durationMs: number; playing: boolean }) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [title, setTitle] = useState('Vídeo do YouTube');
  const [artist, setArtist] = useState('');
  const [state, setState] = useState(-1);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const [error, setError] = useState('');
  useEffect(() => { onPlayback({ title, artist, positionMs: position * 1000, durationMs: duration * 1000, playing }); }, [title, artist, position, duration, playing, onPlayback]);

  useEffect(() => {
    let cancelled = false;
    setDuration(0); setState(-1); setTitle('Vídeo do YouTube'); setArtist('');
    setReady(false); setPlaying(false); setPosition(0); setError('');
    loadAPI().then(YT => {
      if (cancelled || !mount.current) return;
      const target = document.createElement('div');
      mount.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        videoId: source.id, width: '100%', height: '100%',
        playerVars: { playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) { setReady(true); player.current?.setVolume(volume); const data = player.current?.getVideoData(); setTitle(data?.title || 'Vídeo do YouTube'); setArtist(data?.author || ''); } },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            setState(event.data); setPosition(player.current?.getCurrentTime() || 0);
            setPlaying(event.data === 1);
            setDuration(player.current?.getDuration() || 0);
            const data = player.current?.getVideoData();
            setTitle(data?.title || 'Vídeo do YouTube');
            setArtist(data?.author || '');
          },
          onError: (event: { data: number }) => {
            if (cancelled) return;
            setReady(false); setPlaying(false);
            setError([101, 150].includes(event.data) ? 'O canal bloqueou a reprodução incorporada.' : 'Vídeo indisponível neste player.');
          },
        },
      });
    }).catch(err => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; mount.current?.replaceChildren(); };
  }, [source.id]);
  useEffect(() => {
    if (!active) player.current?.pauseVideo();
  }, [active]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      setPosition(player.current?.getCurrentTime() || 0);
      setDuration(player.current?.getDuration() || 0);
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready]);
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  const status = offline ? 'Sem conexão' : error ? 'Indisponível' : !ready ? 'Carregando' : ({ 0: 'Encerrado', 1: 'Reproduzindo', 2: 'Pausado', 3: 'Carregando vídeo' }[state] ?? 'Pronto para tocar');
  return <div className="youtube-main-player">
    <div className="youtube-heading"><span role="status">YouTube · {status}</span><button onClick={onClose} aria-label="Fechar player do YouTube"><X size={17}/></button></div>
    <div className="youtube-video" ref={mount} aria-label="Player de vídeo do YouTube"/>
    <h2>{title}</h2>
    {artist && <p className="youtube-artist">{artist}</p>}
    {error && <p role="alert">{error} <a href={source.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube</a></p>}
    <div className="youtube-transport"><button disabled={!ready} onClick={() => playing ? player.current?.pauseVideo() : player.current?.playVideo()} aria-label={playing ? 'Pausar YouTube' : 'Reproduzir YouTube'}>{playing ? <Pause size={21}/> : <Play size={21}/>}</button><span>{time(position)}</span><input aria-label="Posição no YouTube" type="range" min="0" max={Math.max(1, duration)} value={position} disabled={!ready || !duration} onChange={e => { const next = Number(e.target.value); player.current?.seekTo(next, true); setPosition(next); }}/><span>{time(duration)}</span><Volume2 size={17}/><input aria-label="Volume do YouTube" disabled={!ready} className="youtube-volume" type="range" min="0" max="100" value={volume} onChange={e => { const next = Number(e.target.value); setVolume(next); player.current?.setVolume(next); }}/></div>
  </div>;
}
