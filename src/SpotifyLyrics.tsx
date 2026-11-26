import { useEffect, useRef, useState } from 'react';
import type { SpotifyTrack } from './spotify';
import { useLyricsAnimation } from './useLyraMotion';

import { KaraokeText, parseSyncedLyrics, type TimedLine as LyricLine } from './Karaoke';
type LrcLibResult = { syncedLyrics?: string | null; plainLyrics?: string | null };
export type SpotifyLookup = { kind: 'miss' | 'error'; durationMs: number; at: string };

const CACHE_KEY = 'lyra:spotifyTranslations';
function savedTranslations(): [string, string][] {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'string') : [];
  } catch { return []; }
}
const translationCache = new Map<string, string>(savedTranslations());
let memoryCoolingUntil = 0;
export function clearSpotifyTranslationCache() { translationCache.clear(); localStorage.removeItem(CACHE_KEY); }

async function translateLine(original: string, signal: AbortSignal): Promise<string> {
  const cached = translationCache.get(original);
  if (cached) return cached;
  let translation = '';
  if (Date.now() >= memoryCoolingUntil) {
    try {
      const query = new URLSearchParams({ q: original, langpair: 'en|pt' });
      const response = await fetch(`https://api.mymemory.translated.net/get?${query}`, { signal });
      if (response.status === 429) memoryCoolingUntil = Date.now() + 60 * 60 * 1000;
      if (response.ok) {
        const data = await response.json() as { responseStatus?: number; responseData?: { translatedText?: string } };
        if (data.responseStatus === 200 && data.responseData?.translatedText) translation = data.responseData.translatedText;
      }
    } catch (error) { if (signal.aborted) throw error; }
  }
  if (!translation) {
    const query = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'pt', dt: 't', q: original });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`, { signal });
    if (!response.ok) throw new Error(`Serviços de tradução indisponíveis (${response.status}).`);
    const data = await response.json() as Array<Array<[string]>>;
    translation = data[0]?.map(part => part[0]).join('') || '';
  }
  translation = new DOMParser().parseFromString(translation, 'text/html').documentElement.textContent?.trim() || '';
  if (!translation) throw new Error('Tradução indisponível para esta faixa.');
  translationCache.set(original, translation);
  if (translationCache.size > 400) translationCache.delete(translationCache.keys().next().value!);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify([...translationCache])); } catch { /* Cache opcional. */ }
  return translation;
}

export function SpotifyLyrics({ track, refreshKey, onLookup, karaoke, large }: { karaoke: boolean; large: boolean; track: SpotifyTrack; refreshKey: number; onLookup: (event: SpotifyLookup) => void }) {
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
    const clean = (value: string) => value.replace(/\[[^\]]*\]|\([^)]*(?:official|video|audio|lyrics?|stream|visuali[sz]er|album)[^)]*\)/gi, ' ').replace(/\b(?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|full\s+album\s+stream|album\s+stream|visuali[sz]er|hd|4k)\b/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s"'“”‘’\-–—:]+|[\s"'“”‘’\-–—:]+$/g, '').trim();
    const cleanedTitle = clean(track.title);
    const cleanedArtist = clean(track.artist.split(',')[0]);
    const params = new URLSearchParams({ track_name: cleanedTitle || track.title, artist_name: cleanedArtist || track.artist.split(',')[0], album_name: track.album, duration: String(Math.round(track.durationMs / 1000)) });
    fetch(`https://lrclib.net/api/get?${params}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok && response.status !== 404) throw new Error('Serviço de letras indisponível.');
        const best = response.ok ? await response.json() as LrcLibResult : null;
        if (best?.syncedLyrics) return best;
        // A busca exata pode escolher um registro sem tempos. Procura uma versão
        // sincronizada com o mesmo título, artista e duração antes de usar a letra plana.
        const search = new URLSearchParams({ track_name: cleanedTitle || track.title, artist_name: cleanedArtist || track.artist.split(',')[0] });
        try {
          const alternativesResponse = await fetch(`https://lrclib.net/api/search?${search}`, { signal: controller.signal });
          if (alternativesResponse.ok) {
            const alternatives = await alternativesResponse.json() as Array<LrcLibResult & { trackName: string; artistName: string; duration: number }>;
            const normalized = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const titleScore = (name: string) => normalized(name) === normalized(cleanedTitle || track.title) ? 2 : normalized(name).includes(normalized(cleanedTitle || track.title)) || normalized(cleanedTitle || track.title).includes(normalized(name)) ? 1 : 0;
            const artistScore = (name: string) => normalized(name) === normalized(cleanedArtist || track.artist.split(',')[0]) ? 2 : normalized(name).includes(normalized(cleanedArtist || track.artist.split(',')[0])) || normalized(cleanedArtist || track.artist.split(',')[0]).includes(normalized(name)) ? 1 : 0;
            const match = alternatives.filter(item => item.syncedLyrics && Math.abs(item.duration - track.durationMs / 1000) <= 8)
              .map(item => ({ item, score: titleScore(item.trackName) * 3 + artistScore(item.artistName) * 2 - Math.min(2, Math.abs(item.duration - track.durationMs / 1000) / 4) }))
              .filter(result => result.score >= 4).sort((a, b) => b.score - a.score)[0]?.item;
            if (match) return match;
          }
        } catch (error) { if (controller.signal.aborted) throw error; }
        if (!best) throw new Error(/full\s+album|album\s+stream|full\s+mix|continuous\s+mix/i.test(track.title)
          ? 'Este vídeo contém um álbum ou mix inteiro. Escolha uma faixa individual no YouTube para sincronizar a letra.'
          : 'Letra não encontrada para esta faixa.');
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
        await Promise.all(Array.from({ length: Math.min(2, next.length) }, async () => {
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
        if (!controller.signal.aborted) setTranslationStatus(failures ? `Os serviços de tradução limitaram ${failures} verso(s). Tente consultar novamente mais tarde.` : 'Tradução automática · revise antes de compartilhar.');
      })
      .catch(error => { if (!controller.signal.aborted) { setStatus(error instanceof Error ? error.message : 'Falha ao buscar letra.'); onLookup({ kind: 'error', durationMs: Math.round(performance.now() - started), at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }); } });
    return () => controller.abort();
  }, [track.id, track.title, track.artist, track.album, track.durationMs, refreshKey, onLookup]);

  const activeEnd = (index: number) => lines[index + 1]?.at ?? track.durationMs;
  const synchronized = lines.some(line => line.at !== null);
  const activeIndex = synchronized ? lines.reduce((index, line, i) => line.at !== null && progressMs >= line.at ? i : index, -1) : -1;
  useLyricsAnimation(listRef, activeIndex, track.id, track.isPlaying, karaoke, large);

  return <div className="spotify-lyrics-wrap">

    {karaoke && lines.length > 0 && <p className="lyrics-message">{synchronized ? (lines[activeIndex]?.words?.every(word => word.at < activeEnd(activeIndex)) ? "Marcação por palavra" : "Preenchimento estimado por verso") : "Sem marcação de tempo · letra tradicional"}</p>}
    {status && <p className="lyrics-message" role="status">{status}</p>}
    {translationStatus && translationStatus !== 'Traduzindo versos…' && <p className="lyrics-message" role="status">{translationStatus}</p>}
    <div className="spotify-lyrics" ref={listRef}>{lines.map((line, index) => <div key={`${index}-${line.at ?? 'plain'}`} className={`spotify-lyric ${index === activeIndex ? 'active' : ''}`} aria-current={index === activeIndex ? 'true' : undefined}>
      {karaoke && index === activeIndex ? <KaraokeText line={line} position={progressMs} end={activeEnd(index)}/> : <strong>{line.original}</strong>}
      <em>{line.translation || (translationStatus === 'Traduzindo versos…' ? 'Traduzindo…' : 'Tradução indisponível')}</em>
    </div>)}</div>
    {lines.length > 0 && <span className="sr-only">{synchronized ? 'Letra sincronizada com a reprodução.' : 'Esta faixa só tem letra sem tempos.'} {translationStatus}</span>}
  </div>;
}
