export type LyricLine = { at: number; original: string; translation: string };
export type Song = { id: string; title: string; artist: string; album: string; duration: number; accent: string; lines: LyricLine[] };
export const songs: Song[] = [];
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
