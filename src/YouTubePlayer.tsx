import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { MusicSource } from './sourceRecognition';

type Player = {
  destroy(): void; playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void; unMute(): void; isMuted(): boolean; getVolume(): number;
  setVolume(volume: number): void; getCurrentTime(): number; getDuration(): number; getVideoData(): { title?: string; author?: string };
};
type YouTubeAPI = { Player: new (element: HTMLElement, options: object) => Player };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      apiPromise = undefined;
      reject(new Error('Não foi possível conectar ao player do YouTube.'));
    };
    const timeout = window.setTimeout(fail, 12000);
    script.onerror = fail;
    window.onYouTubeIframeAPIReady = () => {
      if (!window.YT?.Player) { fail(); return; }
      cleanup();
      resolve(window.YT);
      previous?.();
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function YouTubePlayer({ source, active, onClose, onPlayback }: { source: MusicSource; active: boolean; onClose: () => void; onPlayback: (state: { videoId: string; title: string; artist: string; positionMs: number; durationMs: number; playing: boolean }) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [muted, setMuted] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const previousVolume = useRef(72);
  const pendingSeek = useRef<{ target: number; expires: number } | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [state, setState] = useState(-1);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const [error, setError] = useState('');
  useEffect(() => { onPlayback({ videoId: source.id, title, artist, positionMs: position * 1000, durationMs: duration * 1000, playing }); }, [title, artist, position, duration, playing, source.id, onPlayback]);

  useEffect(() => {
    let cancelled = false;
    setDuration(0); setState(-1); setTitle(''); setArtist('');
    setReady(false); setPlaying(false); setPosition(0); setError('');
    loadAPI().then(YT => {
      if (cancelled || !mount.current) return;
      const target = document.createElement('div');
      mount.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        videoId: source.id, width: '100%', height: '100%',
        playerVars: { playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) { setError(''); setReady(true); setDuration(player.current?.getDuration() || 0); const data = player.current?.getVideoData(); setTitle(data?.title || ''); setArtist(data?.author || ''); } },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            setState(event.data);
            setPlaying(event.data === 1);
            setDuration(player.current?.getDuration() || 0);
            const data = player.current?.getVideoData();
            setTitle(data?.title || '');
            setArtist(data?.author || '');
          },
          onError: (event: { data: number }) => {
            if (cancelled) return;
            setReady(false); setPlaying(false);
            const messages: Record<number, string> = {
              2: 'O YouTube recebeu um identificador de vídeo inválido.',
              5: 'O navegador não conseguiu reproduzir este vídeo.',
              100: 'Este vídeo foi removido, é privado ou está indisponível.',
              101: 'O YouTube recusou a reprodução incorporada deste vídeo.',
              150: 'O YouTube recusou a reprodução incorporada deste vídeo.',
              153: 'O YouTube não recebeu a identificação de origem. Verifique as configurações de privacidade e extensões do navegador.',
            };
            setError(`${messages[event.data] || 'Falha ao carregar o vídeo.'} (YouTube ${event.data})`);
          },
        },
      });
    }).catch(err => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; mount.current?.replaceChildren(); };
  }, [source.id]);
  useEffect(() => {
    if (!active && ready) player.current?.pauseVideo();
  }, [active, ready]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const current = player.current;
      if (!current) return;
      const actual = current.getCurrentTime() || 0;
      const pending = pendingSeek.current;
      if (!pending || Math.abs(actual - pending.target) < 1 || performance.now() >= pending.expires) {
        pendingSeek.current = null;
        setPosition(actual);
      }
      setDuration(current.getDuration() || 0);
      setVolume(current.getVolume());
      setMuted(current.isMuted());
      const data = current.getVideoData();
      if (data?.title) setTitle(data.title);
      if (data?.author) setArtist(data.author);
    }, 100);
    return () => window.clearInterval(timer);
  }, [ready]);
  useEffect(() => {
    if (ready || error || offline) return;
    const timeout = window.setTimeout(() => setError('O YouTube demorou para responder.'), 15000);
    return () => window.clearTimeout(timeout);
  }, [ready, error, offline, source.id]);
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  const status = offline ? 'Sem conexão' : error ? 'Indisponível' : !ready ? 'Carregando' : ({ 0: 'Encerrado', 1: 'Reproduzindo', 2: 'Pausado', 3: 'Carregando vídeo' }[state] ?? 'Pronto para tocar');
  return <div className="youtube-main-player">
    <div className="youtube-heading"><span role="status">YouTube · {status}</span><button onClick={onClose} aria-label="Fechar player do YouTube"><X size={17}/></button></div>
    <div className="youtube-video" ref={mount} aria-label="Player de vídeo do YouTube"/>
    <h2>{title || "Vídeo do YouTube"}</h2>
    {artist && <p className="youtube-artist">{artist}</p>}
    {(error || offline) && <div className="youtube-error">
      <p role="alert">{offline ? "Confira sua conexão com a internet." : error}</p>
      <a href={source.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>
    </div>}
    {!error && !offline && <div className="youtube-transport"><button disabled={!ready} onClick={() => playing ? player.current?.pauseVideo() : player.current?.playVideo()} aria-label={playing ? 'Pausar YouTube' : 'Reproduzir YouTube'}>{playing ? <Pause size={21}/> : <Play size={21}/>}</button><div className="youtube-timeline"><span>{time(position)}</span><div className="youtube-scrubber">
      <input aria-label="Posição no YouTube" aria-valuetext={time(position)} type="range" min="0" max={Math.max(.1, duration)} step=".1"
        value={Math.min(position, duration)} disabled={!ready || !duration}
        onPointerMove={event => {
          if (!duration || event.pointerType === 'touch') return;
          const box = event.currentTarget.getBoundingClientRect();
          const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
          setPreview(fraction * duration);
        }}
        onPointerLeave={() => setPreview(null)}
        onChange={event => {
          const current = player.current;
          if (!current) return;
          const target = Number(event.target.value);
          current.seekTo(target, true);
          pendingSeek.current = { target, expires: performance.now() + 1200 };
          setPosition(target);
        }}/>
      {preview !== null && <span className="youtube-seek-preview" aria-hidden="true">{time(preview)}</span>}
      </div><span>{time(duration)}</span></div><div className="youtube-volume-controls"><button type="button" disabled={!ready} aria-label={muted || volume === 0 ? 'Restaurar volume do YouTube' : 'Silenciar YouTube'} onClick={() => {
      const current = player.current;
      if (!current) return;
      if (current.isMuted() || current.getVolume() === 0) {
        if (current.getVolume() === 0) current.setVolume(previousVolume.current);
        current.unMute();
      } else {
        previousVolume.current = current.getVolume();
        current.mute();
      }
    }}>{muted || volume === 0 ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
    <input aria-label="Volume do YouTube" disabled={!ready} className="youtube-volume" type="range" min="0" max="100" value={muted ? 0 : volume} onChange={event => {
      const next = Number(event.target.value);
      const current = player.current;
      if (!current) return;
      if (current.getVolume() > 0) previousVolume.current = current.getVolume();
      if (next > 0) current.unMute();
      current.setVolume(next);
    }}/></div></div>}
  </div>;
}
