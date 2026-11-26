import type { CSSProperties } from 'react';

type Word = { at: number; text: string };
export type TimedLine = { at: number | null; original: string; translation?: string; words?: Word[] };

function milliseconds(minutes: string, seconds: string, fraction = '') {
  return Number(minutes) * 60000 + Number(seconds) * 1000 + Number(fraction.padEnd(3, '0'));
}

export function parseSyncedLyrics(value: string): TimedLine[] {
  const lines = new Map<number, TimedLine>();
  for (const raw of value.split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):([0-5]\d)(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!match) continue;
    const at = milliseconds(match[1], match[2], match[3]);
    const tags = /<(\d+):([0-5]\d)(?:\.(\d{1,3}))?>/g;
    const original = match[4].replace(tags, '').trim();
    if (!original || !Number.isSafeInteger(at) || lines.has(at)) continue;
    const markers = [...match[4].matchAll(tags)];
    const words = markers.map((marker, i) => ({
      at: milliseconds(marker[1], marker[2], marker[3]),
      text: match[4].slice(marker.index! + marker[0].length, markers[i + 1]?.index),
    })).filter(word => word.text.length);
    const valid = words.map(word => word.text).join('').trim() === original &&
      words.every((word, i) => Number.isSafeInteger(word.at) && word.at >= at && (!i || word.at > words[i - 1].at));
    lines.set(at, { at, original, words: valid ? words : undefined });
  }
  const ordered = [...lines.values()].sort((a, b) => a.at! - b.at!);
  return ordered.map((line, i) => line.words?.some(word => word.at >= (ordered[i + 1]?.at ?? Infinity))
    ? { ...line, words: undefined } : line);
}

export function KaraokeText({ line, position, end }: { line: TimedLine; position: number; end: number }) {
  const fill = (start: number, stop: number): CSSProperties => ({
    '--sung': Math.min(100, Math.max(0, (position - start) / Math.max(1, stop - start) * 100)) + '%',
  } as CSSProperties);
  const words = line.words;
  return <strong>{words?.length && words[words.length - 1].at < end
    ? words.map((word, i) => <span className="sung-text" key={word.at} style={fill(word.at, words[i + 1]?.at ?? end)}>{word.text}</span>)
    : <span className="sung-text" style={fill(line.at ?? 0, end)}>{line.original}</span>}</strong>;
}
