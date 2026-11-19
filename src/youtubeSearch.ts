export type YouTubeResult = { id: string; title: string; channel: string; thumbnail: string };
export type YouTubeChapter = { at: number; title: string };

// The Worker URL is public; the YouTube API key stays in Cloudflare secrets.
export const youtubeSearchUrl = import.meta.env.VITE_YOUTUBE_SEARCH_URL?.trim() || 'https://lyraflow-youtube-search.lyraflow-iago.workers.dev';

export async function getYouTubeChapters(id: string, signal: AbortSignal): Promise<YouTubeChapter[]> {
  const url = new URL('/chapters', youtubeSearchUrl);
  url.searchParams.set('id', id);
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = await response.json() as { chapters?: YouTubeChapter[] };
  return Array.isArray(data.chapters) ? data.chapters : [];
}

export async function searchYouTube(query: string, signal: AbortSignal): Promise<YouTubeResult[]> {
  const url = new URL('/search', youtubeSearchUrl);
  url.searchParams.set('q', query);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('A busca do YouTube está indisponível.');
  const data = await response.json() as { items?: YouTubeResult[] };
  return Array.isArray(data.items) ? data.items : [];
}
