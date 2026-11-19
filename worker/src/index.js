export default {
  async fetch(request, env) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json' };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);
    if (request.method !== 'GET' || !['/search', '/chapters'].includes(url.pathname)) return Response.json({ error: 'Not found' }, { status: 404, headers });
    if (!env.YOUTUBE_API_KEY) return Response.json({ error: 'Key not configured' }, { status: 503, headers });
    if (url.pathname === '/chapters') {
      const id = url.searchParams.get('id') || '';
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return Response.json({ chapters: [] }, { headers });
      const api = new URL('https://www.googleapis.com/youtube/v3/videos');
      api.search = new URLSearchParams({ part: 'snippet', id, key: env.YOUTUBE_API_KEY }).toString();
      const response = await fetch(api);
      if (!response.ok) return Response.json({ chapters: [] }, { headers });
      const body = await response.json();
      const description = body.items?.[0]?.snippet?.description || '';
      const chapters = description.split(/\r?\n/).flatMap(line => {
        const match = line.match(/(?:^|\s)(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—.:|]?\s*(.{2,100})$/);
        if (!match) return [];
        const at = (Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
        return [{ at, title: match[4].trim() }];
      });
      const unique = chapters.filter((chapter, index) => index === 0 || chapter.at > chapters[index - 1].at);
      return Response.json({ chapters: unique.length >= 2 ? unique : [] }, { headers: { ...headers, 'Cache-Control': 'public, max-age=3600' } });
    }
    const query = (url.searchParams.get('q') || '').trim().slice(0, 120);
    if (query.length < 2) return Response.json({ items: [] }, { headers });
    const api = new URL('https://www.googleapis.com/youtube/v3/search');
    api.search = new URLSearchParams({ part: 'snippet', type: 'video', videoCategoryId: '10', maxResults: '30', q: query, key: env.YOUTUBE_API_KEY }).toString();
    const response = await fetch(api);
    const body = await response.json();
    if (!response.ok) return Response.json({ error: 'YouTube search unavailable' }, { status: response.status, headers });
    const rank = item => { const title = item.snippet?.title || ''; const channel = item.snippet?.channelTitle || ''; return (/official (music )?video|official audio|\btopic\b/i.test(`${title} ${channel}`) ? 10 : 0) - (/full album|album stream|reaction|cover|review|lyrics? video/i.test(title) ? 15 : 0); };
    const items = (body.items || []).sort((a, b) => rank(b) - rank(a)).flatMap(item => item.id?.videoId ? [{ id: item.id.videoId, title: item.snippet?.title || '', channel: item.snippet?.channelTitle || '', thumbnail: item.snippet?.thumbnails?.medium?.url || '' }] : []);
    return Response.json({ items }, { headers: { ...headers, 'Cache-Control': 'public, max-age=120' } });
  },
};
