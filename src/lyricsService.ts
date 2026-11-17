import { songs, type LyricLine } from './data';
export interface ILyricsService { getLyrics(songId: string): LyricLine[] | undefined }
export class LyricsService implements ILyricsService { getLyrics(songId: string) { return songs.find(song => song.id === songId)?.lines; } }
export type ProxyEvent = { songId: string; kind: 'hit' | 'miss' | 'missing'; at: string };
export class LyricsProxy implements ILyricsService {
  private cache = new Map<string, LyricLine[]>();
  private events: ProxyEvent[] = [];
  constructor(private source: ILyricsService) {}
  getLyrics(songId: string) {
    const saved = this.cache.get(songId);
    const kind = saved ? 'hit' : 'miss';
    const lines = saved ?? this.source.getLyrics(songId);
    this.events.unshift({ songId, kind: lines ? kind : 'missing', at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    if (lines && !saved) this.cache.set(songId, lines);
    return lines;
  }
  history() { return [...this.events]; }
  clear() { this.cache.clear(); this.events = []; }
}
export const lyricsProxy = new LyricsProxy(new LyricsService());
