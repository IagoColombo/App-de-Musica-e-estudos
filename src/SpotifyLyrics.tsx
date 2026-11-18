import { useEffect, useRef, useState } from 'react';
import type { SpotifyTrack } from './spotify';

type LyricLine = { at: number | null; original: string; translation?: string };
type LrcLibResult = { syncedLyrics?: string | null; plainLyrics?: string | null };
export type SpotifyLookup = { kind: 'miss' | 'error'; durationMs: number; at: string };

const translationCache = new Map<string, string>();
export function clearSpotifyTranslationCache() { translationCache.clear(); }

export function parseSyncedLyrics(value: string): LyricLine[] {
  return value.split(/\r?\n/).flatMap(raw => {
    const match = raw.match(/^\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!match || !match[4].trim()) return [];
    const fraction = Number((match[3] || '').padEnd(3, '0'));
    return [{ at: (Number(match[1]) * 60 + Number(match[2])) * 1000 + fraction, original: match[4].trim() }];
  });
}

async function translateLine(original: string, signal: AbortSignal): Promise<string> {
  const cached = translationCache.get(original);
  if (cached) return cached;
  const query = new URLSearchParams({ q: original, langpair: 'en|pt-BR' });
  const response = await fetch(`https://api.mymemory.translated.net/get?${query}`, { signal });
  if (!response.ok) throw new Error(`Serviço de tradução indisponível (${response.status}).`);
  const data = await response.json() as { responseStatus?: number; responseData?: { translatedText?: string } };
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) throw new Error('Tradução indisponível para esta faixa.');
  const translation = new DOMParser().parseFromString(data.responseData.translatedText, 'text/html').documentElement.textContent?.trim() || '';
  if (!translation) throw new Error('Tradução indisponível para esta faixa.');
  translationCache.set(original, translation);
  return translation;
}

export function SpotifyLyrics({ track, refreshKey, onLookup }: { track: SpotifyTrack; refreshKey: number; onLookup: (event: SpotifyLookup) => void }) {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [status, setStatus] = useState('Buscando letra…');
  const [translationStatus, setTranslationStatus] = useState('');
  const [progressMs, setProgressMs] = useState(track.progressMs);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProgressMs(track.progressMs);
    if (!track.isPlaying) return;
    const started = Date.now();
    const timer = window.setInterval(() => setProgressMs(Math.min(track.durationMs, track.progressMs + Date.now() - started)), 250);
    return () => window.clearInterval(timer);
  }, [track.id, track.progressMs, track.durationMs, track.isPlaying]);

  useEffect(() => {
    const controller = new AbortController();
    const started = performance.now();
    setLines([]);
    setStatus('Buscando letra…');
    setTranslationStatus('');
    const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist.split(',')[0], album_name: track.album, duration: String(Math.round(track.durationMs / 1000)) });
    fetch(`https://lrclib.net/api/get?${params}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok && response.status !== 404) throw new Error('Serviço de letras indisponível.');
        const best = response.ok ? await response.json() as LrcLibResult : null;
        if (best?.syncedLyrics) return best;
        // A busca exata pode escolher um registro sem tempos. Procura uma versão
        // sincronizada com o mesmo título, artista e duração antes de usar a letra plana.
        const search = new URLSearchParams({ track_name: track.title, artist_name: track.artist.split(',')[0] });
        try {
          const alternativesResponse = await fetch(`https://lrclib.net/api/search?${search}`, { signal: controller.signal });
          if (alternativesResponse.ok) {
            const alternatives = await alternativesResponse.json() as Array<LrcLibResult & { trackName: string; artistName: string; duration: number }>;
            const normalized = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const match = alternatives.find(item => item.syncedLyrics && normalized(item.trackName) === normalized(track.title) && normalized(item.artistName) === normalized(track.artist.split(',')[0]) && Math.abs(item.duration - track.durationMs / 1000) <= 2);
            if (match) return match;
          }
        } catch (error) { if (controller.signal.aborted) throw error; }
        if (!best) throw new Error('Letra não encontrada para esta faixa.');
        return best;
      })
      .then(async data => {
        const timed = parseSyncedLyrics(data.syncedLyrics || '');
        const next: LyricLine[] = timed.length ? timed : String(data.plainLyrics || '').split(/\r?\n/).map(original => ({ at: null, original: original.trim() })).filter(line => line.original);
        if (controller.signal.aborted) return;
        setLines(next);
        setStatus(next.length ? '' : 'Letra não encontrada para esta faixa.');
        onLookup({ kind: next.length ? 'miss' : 'error', durationMs: Math.round(performance.now() - started), at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
        if (!next.length) return;
        setTranslationStatus('Traduzindo versos…');
        let failures = 0;
        // Limita a quantidade simultânea de consultas e atualiza a tela conforme cada verso chega.
        let cursor = 0;
        await Promise.all(Array.from({ length: Math.min(3, next.length) }, async () => {
          while (cursor < next.length && !controller.signal.aborted) {
            const index = cursor++;
            try {
              const translation = await translateLine(next[index].original, controller.signal);
              if (!controller.signal.aborted) setLines(current => current.map((line, i) => i === index ? { ...line, translation } : line));
            } catch {
              if (!controller.signal.aborted) failures++;
            }
          }
        }));
        if (!controller.signal.aborted) setTranslationStatus(failures ? `Tradução indisponível para ${failures} verso(s).` : 'Tradução automática · revise antes de compartilhar.');
      })
      .catch(error => { if (!controller.signal.aborted) { setStatus(error instanceof Error ? error.message : 'Falha ao buscar letra.'); onLookup({ kind: 'error', durationMs: Math.round(performance.now() - started), at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }); } });
    return () => controller.abort();
  }, [track.id, track.title, track.artist, track.album, track.durationMs, refreshKey, onLookup]);

  const synchronized = lines.some(line => line.at !== null);
  const activeIndex = synchronized ? lines.reduce((index, line, i) => line.at !== null && progressMs >= line.at ? i : index, -1) : -1;
  useEffect(() => {
    if (activeIndex < 0 || !track.isPlaying) return;
    const active = listRef.current?.querySelector<HTMLElement>('.spotify-lyric.active');
    active?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeIndex, track.isPlaying]);

  return <div className="spotify-lyrics-wrap">

    {status && <p className="lyrics-message" role="status">{status}</p>}
    <div className="spotify-lyrics" ref={listRef}>{lines.map((line, index) => <div key={`${index}-${line.at ?? 'plain'}`} className={`spotify-lyric ${index === activeIndex ? 'active' : ''}`} aria-current={index === activeIndex ? 'true' : undefined}>
      <strong>{line.original}</strong>
      <em>{line.translation || (translationStatus === 'Traduzindo versos…' ? 'Traduzindo…' : 'Tradução indisponível')}</em>
    </div>)}</div>
    {lines.length > 0 && <span className="sr-only">{synchronized ? 'Letra sincronizada com o Spotify.' : 'Esta faixa só tem letra sem tempos.'} {translationStatus}</span>}
  </div>;
}
