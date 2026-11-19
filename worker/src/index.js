export default {
  async fetch(request, env) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json' };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/search') return Response.json({ error: 'Not found' }, { status: 404, headers });
    const query = (url.searchParams.get('q') || '').trim().slice(0, 120);
    if (query.length < 2) return Response.json({ items: [] }, { headers });
    if (!env.YOUTUBE_API_KEY) return Response.json({ error: 'Key not configured' }, { status: 503, headers });
    const api = new URL('https://www.googleapis.com/youtube/v3/search');
    api.search = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '8', q: query, key: env.YOUTUBE_API_KEY }).toString();
    const response = await fetch(api);
    const body = await response.json();
    if (!response.ok) return Response.json({ error: 'YouTube search unavailable' }, { status: response.status, headers });
    const items = (body.items || []).flatMap(item => item.id?.videoId ? [{ id: item.id.videoId, title: item.snippet?.title || '', channel: item.snippet?.channelTitle || '', thumbnail: item.snippet?.thumbnails?.medium?.url || '' }] : []);
    return Response.json({ items }, { headers: { ...headers, 'Cache-Control': 'public, max-age=120' } });
  },
};
