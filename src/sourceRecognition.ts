export type MusicSource = { provider: 'Spotify' | 'YouTube'; id: string; url: string; embedUrl: string };

export function recognizeMusicLink(value: string): MusicSource | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'open.spotify.com' && parts[0] === 'track' && /^[a-zA-Z0-9]{22}$/.test(parts[1] || '')) {
    const id = parts[1];
    return { provider: 'Spotify', id, url: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}` };
  }
  if (host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? parts[0] : parts[0] === 'shorts' ? parts[1] : url.searchParams.get('v');
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { provider: 'YouTube', id, url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  return null;
}
